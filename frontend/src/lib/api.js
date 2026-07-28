import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const demoLogin = (name) => api.post("/auth/demo-login", { name }).then(r => r.data);
export const getCarbonStats = () => api.get("/carbon/stats").then(r => r.data);
export const getTrackerLive = () => api.get("/tracker/live").then(r => r.data);
export const simulateFuture = (payload) => api.post("/future/simulate", payload).then(r => r.data);
export const getCommunityFeed = (userId) => api.get("/community/feed", { params: userId ? { user_id: userId } : {} }).then(r => r.data);
export const likePost = (payload) => api.post("/community/like", payload).then(r => r.data);
export const commentPost = (payload) => api.post("/community/comment", payload).then(r => r.data);
export const joinChallenge = (payload) => api.post("/community/join", payload).then(r => r.data);
export const createPost = (payload) => api.post("/community/post", payload).then(r => r.data);
export const sendChat = (session_id, message) => api.post("/chat/sustainability", { session_id, message }).then(r => r.data);
export const predictDay = (payload) => api.post("/predict/day", payload).then(r => r.data);
export const getVoiceTips = (payload) => api.post("/voice/call-tips", payload).then(r => r.data);
export const scanFood = (payload) => api.post("/food/scan", payload).then(r => r.data);
export const generateCertificate = (payload) => api.post("/certificate/generate", payload).then(r => r.data);
