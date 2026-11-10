import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Calendar as CalendarIcon, Info } from 'lucide-react';
import { formatDateFr } from '../utils/formatters';
import type { Busy } from '../utils/api';

interface Step3DateProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onNext: () => void;
  onPrev: () => void;
  busy: Busy[];
}

export const Step3Date: React.FC<Step3DateProps> = ({ selectedDate, onSelectDate, onNext, onPrev, busy }) => {
  const ctaButtonRef = useRef<HTMLButtonElement>(null);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(() => today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => today.getMonth()); // 0-indexed

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Build calendar matrix
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // 0 = Lundi, 6 = Dimanche

  const calendarDays = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Check booked state for a specific date
  const getDateStatus = (day: number) => {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

    const checkDate = new Date(currentYear, currentMonth, day);
    checkDate.setHours(0, 0, 0, 0);

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);

    if (checkDate < startToday) {
      return { status: 'past', label: 'Passé', dateStr };
    }

    const dayBookings = busy.filter((b) => b.date === dateStr);
    if (dayBookings.length >= 5) {
      return { status: 'full', label: 'Complet', dateStr };
    }

    return { status: 'available', label: 'Libre', count: dayBookings.length, dateStr };
  };

  const handleSelectDay = (dateStr: string) => {
    onSelectDate(dateStr);
    setTimeout(() => {
      ctaButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0d0d14] border border-[#2c2c44] p-4 sm:p-6 shadow-xs">
        {/* Header */}
        <div className="border-b border-[#2c2c44] pb-4 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-white ">Choisissez la date de votre live</h2>
          <p className="text-xs text-[#dde4f0] mt-1">Le studio est ouvert tous les jours, dimanche compris. Un seul live à la fois.</p>
        </div>

        {/* Calendar Nav */}
        <div className="border border-[#2c2c44] bg-[#0d0d14] p-2 sm:p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex items-center gap-1 border border-[#2c2c44] bg-[#0d0d14] px-2.5 py-1 text-xs font-bold text-[#dde4f0] hover:bg-[#14141f] cursor-pointer"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Précédent</span>
            </button>

            <div className="text-center">
              <h3 className="text-sm sm:text-base font-bold text-white">
                {monthNames[currentMonth]} {currentYear}
              </h3>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="flex items-center gap-1 border border-[#2c2c44] bg-[#0d0d14] px-2.5 py-1 text-xs font-bold text-[#dde4f0] hover:bg-[#14141f] cursor-pointer"
              aria-label="Mois suivant"
            >
              <span className="hidden sm:inline">Suivant</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Color-coded Legend */}
          <div className="flex items-center justify-center gap-4 text-xs font-bold py-2 px-3 bg-[#0d0d14] border border-[#2c2c44] mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00ffcc] inline-block shrink-0"></span>
              <span className="text-white">Libre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c4005f] inline-block shrink-0"></span>
              <span className="text-[#ff7ab3]">Complet</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#aab3c5] inline-block shrink-0"></span>
              <span className="text-[#aab3c5]">Passé</span>
            </div>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-[#dde4f0] border-b border-[#2c2c44] pb-2 mb-2 ">
            <span>Lun</span>
            <span>Mar</span>
            <span>Mer</span>
            <span>Jeu</span>
            <span>Ven</span>
            <span>Sam</span>
            <span className="text-[#00ffcc]">Dim</span>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="p-1 sm:p-2 min-h-[44px]" />;
              }

              const info = getDateStatus(day);
              const isSelected = selectedDate === info.dateStr;

              if (info.status === 'past') {
                return (
                  <div
                    key={info.dateStr}
                    className="p-1.5 sm:p-2.5 border border-[#2c2c44] bg-[#14141f] text-[#aab3c5] text-center min-h-[48px] flex flex-col justify-between items-center opacity-40 cursor-not-allowed"
                    title="Date passée non réservable"
                  >
                    <span className="text-xs font-bold tabular-nums">{day}</span>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-2 h-2 rounded-full bg-[#aab3c5] inline-block sm:hidden"></span>
                      <span className="hidden sm:inline text-[9px] font-bold text-[#aab3c5]">Passé</span>
                    </div>
                  </div>
                );
              }

              if (info.status === 'full') {
                return (
                  <div
                    key={info.dateStr}
                    className="p-1.5 sm:p-2.5 border border-[#ff007f] bg-[rgba(255,0,127,0.12)] text-[#ff7ab3] text-center min-h-[48px] flex flex-col justify-between items-center cursor-not-allowed"
                    title="Journée complète"
                  >
                    <span className="text-xs font-bold tabular-nums">{day}</span>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#c4005f] inline-block"></span>
                      <span className="hidden sm:inline text-[9px] font-bold text-[#ff7ab3]">Complet</span>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={info.dateStr}
                  type="button"
                  onClick={() => handleSelectDay(info.dateStr)}
                  className={`p-1.5 sm:p-2.5 border text-center transition-all min-h-[48px] flex flex-col justify-between items-center cursor-pointer ${
                    isSelected
                      ? 'border-[#00ffcc] bg-[#00ffcc] text-[#050508] font-bold ring-2 ring-[#00ffcc]'
                      : 'border-[#2c2c44] bg-[#0d0d14] hover:bg-[rgba(0,255,204,0.08)] text-white'
                  }`}
                >
                  <span className="text-xs tabular-nums font-bold">{day}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${isSelected ? 'bg-[#0d0d14]' : 'bg-[#00ffcc]'}`}></span>
                    <span className={`hidden sm:inline text-[9px] font-bold ${isSelected ? 'text-white' : 'text-white'}`}>Dispo</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Summary & CTA */}
        {selectedDate && (
          <div className="border-2 border-[#00ffcc] bg-[rgba(0,255,204,0.08)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-[#dde4f0] font-bold block">Date choisie</span>
              <p className="text-base font-bold text-white capitalize">{formatDateFr(selectedDate)}</p>
            </div>

            <button
              ref={ctaButtonRef}
              type="button"
              onClick={onNext}
              className="flex items-center justify-center gap-2 border border-[#00ffcc] bg-[#00ffcc] px-5 py-3 text-xs font-bold text-[#050508] hover:bg-[#00d9ad] cursor-pointer transition-colors shadow-xs"
            >
              <span>Choisir l'heure</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        )}

        {/* Nav Buttons */}
        <div className="mt-6 pt-4 border-t border-[#2c2c44] flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            className="flex items-center gap-1.5 border border-[#2c2c44] bg-[#0d0d14] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#14141f] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#00ffcc]" />
            <span>Étape précédente</span>
          </button>
        </div>
      </div>
    </div>
  );
};
