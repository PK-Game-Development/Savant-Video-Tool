import React, { createContext, useContext, useState } from "react";

const CalendarContext = createContext({
  currentMonth: null,
  setCurrentMonth: () => {},
});

export function CalendarProvider({ children }) {
  const [currentMonth, setCurrentMonth] = useState(null);
  return (
    <CalendarContext.Provider value={{ currentMonth, setCurrentMonth }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  return useContext(CalendarContext);
}
