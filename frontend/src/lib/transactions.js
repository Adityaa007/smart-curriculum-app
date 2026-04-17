import { doc, getDoc, runTransaction, collection, query, where, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Ensures global uniqueness of the registration number via transaction.
 * Creates `counters/global` on the fly if it doesn't exist.
 */
export async function generateRegistrationNumberTransaction() {
  const counterRef = doc(db, "counters", "global");
  const year = new Date().getFullYear();

  return await runTransaction(db, async (t) => {
    const docSnap = await t.get(counterRef);
    let count = 1;

    if (docSnap.exists() && docSnap.data().registrationCounter) {
      count = docSnap.data().registrationCounter + 1;
    }

    t.set(counterRef, { registrationCounter: count }, { merge: true });

    // Format: REG20260001
    const padding = count.toString().padStart(4, "0");
    return `REG${year}${padding}`;
  });
}

/**
 * Searches and validates the 6-digit Join Code globally.
 */
async function findSectionByJoinCode(joinCode) {
  const q = query(collection(db, "sections"), where("joinCode", "==", joinCode.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0];
}

/**
 * Securely joins a student to a section inside a strict transaction hook.
 * Formats explicitly e.g CS-A-001
 */
export async function joinClassSectionTransaction(userId, joinCode) {
  const upperCode = joinCode.toUpperCase();
  
  // Preliminary out-of-transaction read to fetch the precise section Document Reference.
  // We cannot reliably query *inside* a raw Firestore web sdk transaction without references.
  const sectionDocSnap = await findSectionByJoinCode(upperCode);
  if (!sectionDocSnap) throw new Error("Invalid join code. Section not found.");
  
  const sectionRef = doc(db, "sections", sectionDocSnap.id);
  const userRef = doc(db, "users", userId);

  return await runTransaction(db, async (t) => {
    // Read both docs inside transaction
    const userSnap = await t.get(userRef);
    const secSnap = await t.get(sectionRef);

    if (!userSnap.exists()) throw new Error("User document missing");
    if (!secSnap.exists()) throw new Error("Section unexpectedly wiped out");

    const userData = userSnap.data();
    const secData = secSnap.data();

    // CONSTRAINT 1: Prevent reassignment
    if (userData.assignedSection) {
      throw new Error(`You are already assigned to section ${userData.assignedSection}`);
    }

    // CONSTRAINT 2: Prevent duplicate roll numbers
    const currentCounter = secData.rollNumberCounter || 1;
    const nextCounter = currentCounter + 1;

    // CONSTRAINT 3: Formulate exact output e.g "CS-A-001"
    const formattedRoll = `${secData.name}-${currentCounter.toString().padStart(3, "0")}`;

    // Mutate Section
    t.update(sectionRef, {
      rollNumberCounter: nextCounter
    });

    // Mutate User
    t.update(userRef, {
      assignedSection: secData.name, // or secSnap.id based on UI rendering
      assignedSectionId: secSnap.id,
      rollNumber: formattedRoll
    });

    return { assignedSection: secData.name, rollNumber: formattedRoll };
  });
}

/**
 * Creates a section and guarantees joinCode uniqueness.
 */
export async function createSectionTransaction(sectionData) {
  // Try generating codes until we safely lock one
  let uniqueCode = null;
  let attempts = 0;
  
  while (!uniqueCode && attempts < 5) {
    const candidate = Math.random().toString(36).substring(2, 8).toUpperCase();
    const existing = await findSectionByJoinCode(candidate);
    if (!existing) uniqueCode = candidate;
    attempts++;
  }

  if (!uniqueCode) throw new Error("Could not generate a unique collision-free join code.");

  const sectionRef = doc(collection(db, "sections"));
  
  await setDoc(sectionRef, {
    ...sectionData,
    joinCode: uniqueCode,
    rollNumberCounter: 1,
    createdAt: new Date().toISOString()
  });

  return { id: sectionRef.id, joinCode: uniqueCode };
}
