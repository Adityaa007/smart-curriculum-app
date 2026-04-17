import { doc, getDoc, runTransaction, collection, setDoc } from "firebase/firestore";
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
 * Creates a section instance in Firestore safely mapped to the executing admin.
 */
export async function createSectionTransaction(sectionData) {
  const sectionRef = doc(collection(db, "sections"));
  
  await setDoc(sectionRef, {
    ...sectionData,
    rollNumberCounter: 1,
    createdAt: new Date().toISOString()
  });

  return { id: sectionRef.id };
}


export async function assignStudentToSectionTransaction(sectionId, studentId) {
  const sectionRef = doc(db, "sections", sectionId);
  const userRef = doc(db, "users", studentId);

  return await runTransaction(db, async (t) => {
    console.log(`[Transaction] Starting assignment | Student: ${studentId} | Section: ${sectionId}`);
    
    const userSnap = await t.get(userRef);
    const secSnap = await t.get(sectionRef);

    if (!userSnap.exists()) throw new Error("Student document missing");
    if (!secSnap.exists()) throw new Error("Section document missing");

    const userData = userSnap.data();
    const secData = secSnap.data();

    if (userData.assignedSection) {
      throw new Error(`Student is already assigned to section ${userData.assignedSection}`);
    }

    const currentCounter = secData.rollNumberCounter || 1;
    const nextCounter = currentCounter + 1;

    const formattedRoll = `${secData.name}-${currentCounter.toString().padStart(3, "0")}`;

    t.update(sectionRef, { rollNumberCounter: nextCounter });

    t.update(userRef, {
      assignedSection: secData.name, 
      assignedSectionId: sectionId,
      rollNumber: formattedRoll
    });

    console.log(`[Transaction] Completed allocation: ${formattedRoll}`);
    return { assignedSection: secData.name, rollNumber: formattedRoll };
  });
}
