import useTitle from "../hooks/useTitle";
import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Star, Save } from "lucide-react";

export default function CareerGoals() {
  useTitle("Career Profile");
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    interests: "",
    strengths: "",
    careerGoal: "",
    studyPreference: "Morning",
    dailyFreeTime: 2,
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        interests: userProfile.interests || "",
        strengths: userProfile.strengths || "",
        careerGoal: userProfile.careerGoal || "",
        studyPreference: userProfile.studyPreference || "Morning",
        dailyFreeTime: userProfile.dailyFreeTime || 2,
      });
    }
  }, [userProfile]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setSuccess(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    setSuccess(false);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        interests: formData.interests,
        strengths: formData.strengths,
        careerGoal: formData.careerGoal,
        studyPreference: formData.studyPreference,
        dailyFreeTime: formData.dailyFreeTime,
      });
      setSuccess(true);
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Star size={20} className="text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Career Goals & Profile</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Complete your profile to receive personalized task suggestions during your free periods.
        </p>
      </div>

      <form onSubmit={handleSave} className="glass-card p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Your Interests
          </label>
          <input
            type="text"
            name="interests"
            value={formData.interests}
            onChange={handleChange}
            placeholder="e.g. AI, Space exploration, Creative writing, Web development"
            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Your Strengths
          </label>
          <input
            type="text"
            name="strengths"
            value={formData.strengths}
            onChange={handleChange}
            placeholder="e.g. Logic, Communication, Detail-oriented, Math"
            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Career Goal
          </label>
          <textarea
            name="careerGoal"
            value={formData.careerGoal}
            onChange={handleChange}
            placeholder="e.g. I want to become a frontend software engineer at a top tech company."
            rows="3"
            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Preferred Study Time
            </label>
            <select
              name="studyPreference"
              value={formData.studyPreference}
              onChange={handleChange}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500/50 transition-colors"
            >
              <option value="Morning">Morning (Deep Work)</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Evening">Evening</option>
              <option value="Night">Night Owl</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Daily Free Time (Hours)
            </label>
            <input
              type="number"
              name="dailyFreeTime"
              value={formData.dailyFreeTime}
              onChange={handleChange}
              min="1"
              max="24"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          {success ? (
            <span className="text-sm font-medium text-emerald-400">✅ Profile saved successfully!</span>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Save Profile
          </button>
        </div>
      </form>
    </div>
  );
}
