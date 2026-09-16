import axios from "axios";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });
api.interceptors.request.use((config) => {
  try {
    const user = JSON.parse(localStorage.getItem("cm_user") || "null");
    if (user?.access_token) {
      config.headers.Authorization = `Bearer ${user.access_token}`;
    }
  } catch {
    // Requests remain usable for public endpoints when local storage is unavailable.
  }
  return config;
});

export const demoLogin = (name) => api.post("/auth/demo-login", { name }).then(r => r.data);
export const registerUser = (name, email, password) => api.post("/auth/register", { name, email, password }).then(r => r.data);
export const loginUser = (email, password) => api.post("/auth/login", { email, password }).then(r => r.data);
export const getCarbonStats = (userId) => api.get("/carbon/stats", { params: { user_id: userId } }).then(r => r.data);
export const getTrackerLive = (userId) => api.get("/tracker/live", { params: { user_id: userId } }).then(r => r.data);
export const saveDailyActivities = (payload) => api.post("/activities/daily", payload).then(r => r.data);
export const simulateFuture = (payload) => api.post("/future/simulate", payload).then(r => r.data);
export const getCommunityFeed = () => api.get("/community/feed").then(r => r.data);
export const likePost = (payload) => api.post("/community/like", payload).then(r => r.data);
export const commentPost = (payload) => api.post("/community/comment", payload).then(r => r.data);
export const joinChallenge = (payload) => api.post("/community/join", payload).then(r => r.data);
export const createPost = (payload) => api.post("/community/post", payload).then(r => r.data);
export const sendChat = (session_id, message) => api.post("/chat/sustainability", { session_id, message }).then(r => r.data);
export const predictDay = (payload) => api.post("/predict/day", payload).then(r => r.data);
export const predictAnnualCarbon = (payload) => api.post("/predict/annual", payload).then(r => r.data);
export const getLifestyleProfile = (userId) => api.get("/profile/lifestyle", { params: { user_id: userId } }).then(r => r.data);
export const saveLifestyleProfile = (payload) => api.put("/profile/lifestyle", payload).then(r => r.data);
export const getVoiceTips = (payload) => api.post("/voice/call-tips", payload).then(r => r.data);
export const scanFood = (payload) => api.post("/food/scan", payload).then(r => r.data);
export const getFoodCatalog = () => api.get("/food/catalog").then(r => r.data);
export const submitFoodFeedback = (payload) => api.post("/food/feedback", payload).then(r => r.data);
export const generateCertificate = (payload) => api.post("/certificate/generate", payload).then(r => r.data);
export const triggerPhoneCall = (payload) => api.post("/voice/phone-call", payload).then(r => r.data);
