import React, { createContext, useContext, useState, useEffect } from "react";

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("cm_user");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("cm_theme") || "dark";
  });

  useEffect(() => {
    if (user) localStorage.setItem("cm_user", JSON.stringify(user));
    else localStorage.removeItem("cm_user");
  }, [user]);

  useEffect(() => {
    localStorage.setItem("cm_theme", theme);
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
