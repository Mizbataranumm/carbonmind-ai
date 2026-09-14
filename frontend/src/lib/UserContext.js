import React, { createContext, useContext, useState, useEffect } from "react";

const UserContext = createContext(null);
const DEFAULT_THEME = "dark";

const getInitialTheme = () => {
  try {
    const savedTheme = localStorage.getItem("cm_theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("cm_user");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    if (user) localStorage.setItem("cm_user", JSON.stringify(user));
    else localStorage.removeItem("cm_user");
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem("cm_theme", theme);
    } catch {
      // The visual preference still works for this visit when storage is unavailable.
    }
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  return (
    <UserContext.Provider value={{ user, setUser, theme, toggleTheme }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
