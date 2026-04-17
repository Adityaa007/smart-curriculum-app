import { getDocs } from "firebase/firestore";

/**
 * Checks if a Firestore error is related to a missing or building index.
 * @param {Error} error 
 * @returns {boolean}
 */
export const isIndexError = (error) => {
  if (!error) return false;
  // "failed-precondition" is the code for missing index
  const hasIndexCode = error.code === "failed-precondition";
  const hasIndexMessage = error.message?.toLowerCase().includes("index") || 
                          error.message?.toLowerCase().includes("building");
  
  return hasIndexCode || hasIndexMessage;
};

/**
 * Wraps getDocs with exponential backoff retry logic for index building errors.
 * @param {Query} q 
 * @param {number} maxRetries 
 * @param {number} baseDelayMs 
 * @returns {Promise<QuerySnapshot>}
 */
export const safeGetDocs = async (q, maxRetries = 3, baseDelayMs = 2000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await getDocs(q);
    } catch (error) {
      lastError = error;
      
      if (!isIndexError(error) || attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(`Firestore index building. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};
