import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const demoLogin = (name) => api.post("/auth/demo-login", { name }).then(r => r.data);
export const getCarbonStats = () => api.get("/carbon/stats").then(r => r.data);
export const getTrackerLive = () => api.get("/tracker/live").then(r => r.data);
export const simulateFuture = (payload) => api.post("/future/simulate", payload).then(r => r.data);
export const getCommunityFeed = () => api.get("/community/feed").then(r => r.data);
export const sendChat = (session_id, message) => api.post("/chat/sustainability", { session_id, message }).then(r => r.data);
