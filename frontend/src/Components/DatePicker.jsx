import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Popover } from "radix-ui";
import {
  MONTH_NAMES, calendarDate, calendarDays, clampPickerValue, dateKey,
  formatPickerValue, isPickerValue, moveCalendarDate, parsePickerText,
} from "../utils/datePicker.js";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const inputClass = "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50";
const buttonClass = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-30";
const selectClass = "h-9 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function DatePicker({
  value = "", onChange, type = "date", name, id, min, max,
  required = false, disabled = false, readOnly = false, clearable = true,
  className, placeholder, "aria-label": ariaLabel, "aria-describedby": describedBy,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const popupId = `${inputId}-calendar`;
  const inputRef = useRef(null);
  const calendarRef = useRef(null);
  const keyboardFocus = useRef(false);
  const focusCalendarOnOpen = useRef(true);
  const restoreFocusOnClose = useRef(true);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const [focusedDate, setFocusedDate] = useState("");
  const [draft, setDraft] = useState(null);
  const isMonth = type === "month";
  const hasTime = type === "datetime-local";
  const today = new Date();
  const todayKey = dateKey(calendarDate(today.getFullYear(), today.getMonth(), today.getDate()));
  const lowerDate = min?.slice(0, isMonth ? 7 : 10) || (isMonth ? "0001-01" : "0001-01-01");
  const upperDate = max?.slice(0, isMonth ? 7 : 10) || (isMonth ? "9999-12" : "9999-12-31");
  const current = clampPickerValue((isPickerValue(value, type) ? value : todayKey).slice(0, isMonth ? 7 : 10), lowerDate, upperDate);
  const [year, month] = (view || current).split("-").map(Number);
  const selectedDate = value.slice(0, isMonth ? 7 : 10);
  const displayed = draft?.value === value ? draft.text : formatPickerValue(value, type);
  const parsed = parsePickerText(displayed, type);
  const formatHint = isMonth ? "MM/YYYY" : hasTime ? "MM/DD/YYYY HH:mm" : "MM/DD/YYYY";
  const error = parsed === null ? `Enter a valid ${isMonth ? "month" : "date"} (${formatHint}).`
    : parsed && min && parsed < min ? `Choose ${formatPickerValue(min, type)} or later.`
      : parsed && max && parsed > max ? `Choose ${formatPickerValue(max, type)} or earlier.` : "";
  const minYear = Number(lowerDate.slice(0, 4));
  const maxYear = Number(upperDate.slice(0, 4));
  const firstYear = Math.max(minYear, Math.min(1900, year));
  const lastYear = Math.min(maxYear, Math.max(today.getFullYear() + 100, year));
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const days = calendarDays(year, month - 1);

  useEffect(() => {
    inputRef.current?.setCustomValidity(error);
  }, [error]);

  useEffect(() => {
    if (open && keyboardFocus.current) {
      calendarRef.current?.querySelector(`[data-date="${focusedDate}"]`)?.focus();
      keyboardFocus.current = false;
    }
  }, [focusedDate, open]);

  const emitChange = (nextValue) => {
    onChange?.({ target: { name, value: nextValue, type, id: inputId }, currentTarget: { name, value: nextValue, type, id: inputId } });
  };

  const changeOpen = (nextOpen, focusCalendar = true) => {
    if (disabled || readOnly) return;
    if (nextOpen) {
      focusCalendarOnOpen.current = focusCalendar;
      restoreFocusOnClose.current = true;
      setView(current);
      setFocusedDate(isMonth ? `${current}-01` : current);
    }
    setOpen(nextOpen);
  };

  const changeView = (nextYear, nextMonth) => {
    const next = calendarDate(nextYear, nextMonth - 1);
    if (next.getUTCFullYear() < 1 || next.getUTCFullYear() > 9999) return;
    const key = dateKey(next).slice(0, 7);
    const clamped = clampPickerValue(key, lowerDate.slice(0, 7), upperDate.slice(0, 7));
    setView(clamped);
    setFocusedDate(clampPickerValue(`${clamped}-01`, lowerDate, upperDate));
  };

  const chooseDate = (nextDate) => {
    let nextValue = nextDate;
    if (hasTime) nextValue = clampPickerValue(`${nextDate}T${value.slice(11) || "00:00"}`, min, max);
    setDraft(null);
    emitChange(nextValue);
    setFocusedDate(isMonth ? `${nextDate}-01` : nextDate);
    setView(nextDate.slice(0, 7));
    if (!hasTime) setOpen(false);
  };

  const handleDayKey = (event, day) => {
    const [dayYear, dayMonth, dayNumber] = day.split("-").map(Number);
    const weekday = calendarDate(dayYear, dayMonth - 1, dayNumber).getUTCDay();
    const movements = {
      ArrowLeft: { days: -1 }, ArrowRight: { days: 1 }, ArrowUp: { days: -7 }, ArrowDown: { days: 7 },
      Home: { days: -weekday }, End: { days: 6 - weekday },
      PageUp: { months: event.shiftKey ? -12 : -1 }, PageDown: { months: event.shiftKey ? 12 : 1 },
    };
    if (!movements[event.key]) return;
    event.preventDefault();
    const next = clampPickerValue(moveCalendarDate(day, movements[event.key]), lowerDate, upperDate);
    keyboardFocus.current = true;
    setView(next.slice(0, 7));
    setFocusedDate(next);
  };

  const viewIndex = year * 12 + month;
  const minIndex = minYear * 12 + Number(lowerDate.slice(5, 7));
  const maxIndex = maxYear * 12 + Number(upperDate.slice(5, 7));
  const tabStop = days.some((day) => day.value === focusedDate) ? focusedDate
    : days.find((day) => !day.outside && day.value >= lowerDate && day.value <= upperDate)?.value;

  return (
    <Popover.Root open={open && !disabled && !readOnly} onOpenChange={changeOpen}>
      <Popover.Anchor asChild>
        <div className="relative min-w-0" data-date-picker={type}>
          {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={displayed}
            placeholder={placeholder || formatHint}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            autoComplete="off"
            aria-label={ariaLabel}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error) || undefined}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? popupId : undefined}
            className={className || inputClass}
            style={{ paddingRight: "5.5rem" }}
            onClick={() => { if (!open) changeOpen(true, false); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                changeOpen(true);
              } else if (event.key === "Escape") setOpen(false);
            }}
            onChange={(event) => {
              const text = event.target.value;
              const nextValue = parsePickerText(text, type);
              setDraft({ text, value: nextValue ?? value });
              if (nextValue !== null) {
                emitChange(nextValue);
                if (nextValue) {
                  setView(nextValue.slice(0, 7));
                  setFocusedDate(isMonth ? `${nextValue}-01` : nextValue.slice(0, 10));
                }
              }
            }}
            onBlur={() => { if (!error) setDraft(null); }}
            onInvalid={() => changeOpen(true)}
          />
          <div className="absolute inset-y-0 right-2 flex items-center gap-1">
            <Popover.Trigger asChild>
              <button type="button" disabled={disabled || readOnly} aria-label="Open calendar" className={buttonClass}>
                <CalendarDays size={19} aria-hidden="true" />
              </button>
            </Popover.Trigger>
            {clearable && (value || displayed) && (
              <button type="button" disabled={disabled || readOnly} aria-label="Clear date"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
                onClick={() => { setDraft(null); emitChange(""); setOpen(false); inputRef.current?.focus(); }}>
                <X size={17} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content ref={calendarRef} id={popupId} data-shared-date-picker="" aria-label={isMonth ? "Choose month" : "Choose date"}
          align="end" sideOffset={10} collisionPadding={12}
          className="z-[10050] w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-[0_14px_24px_-8px_rgba(15,23,42,0.28)] outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (focusCalendarOnOpen.current) calendarRef.current?.querySelector('[data-calendar-focus="true"]')?.focus();
          }}
          onInteractOutside={(event) => {
            if (event.target === inputRef.current) event.preventDefault();
            else restoreFocusOnClose.current = false;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (restoreFocusOnClose.current) inputRef.current?.focus();
          }}>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <select aria-label="Year" value={year} onChange={(event) => changeView(Number(event.target.value), month)} className={selectClass}>
                {years.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-2 top-2.5 text-slate-600" />
            </div>
            <div className="relative">
              <select aria-label="Month" value={month} onChange={(event) => changeView(year, Number(event.target.value))} className={selectClass}>
                {MONTH_NAMES.map((label, index) => {
                  const key = `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`;
                  return <option key={label} value={index + 1} disabled={key < lowerDate.slice(0, 7) || key > upperDate.slice(0, 7)}>{label}</option>;
                })}
              </select>
              <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-2 top-2.5 text-slate-600" />
            </div>
          </div>

          <div className="my-2 flex items-center justify-between">
            <button type="button" className={buttonClass} aria-label={isMonth ? "Previous year" : "Previous month"}
              disabled={isMonth ? year <= minYear : viewIndex <= minIndex}
              onClick={() => changeView(isMonth ? year - 1 : year, isMonth ? month : month - 1)}>
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <p className="text-sm font-semibold text-slate-700" aria-live="polite">{isMonth ? year : `${MONTH_NAMES[month - 1]} ${year}`}</p>
            <button type="button" className={buttonClass} aria-label={isMonth ? "Next year" : "Next month"}
              disabled={isMonth ? year >= maxYear : viewIndex >= maxIndex}
              onClick={() => changeView(isMonth ? year + 1 : year, isMonth ? month : month + 1)}>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>

          {isMonth ? (
            <div className="grid grid-cols-3 gap-2" aria-label={`Months in ${year}`}>
              {MONTH_NAMES.map((label, index) => {
                const key = `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`;
                return <button key={key} type="button" aria-label={`${label} ${year}`} aria-pressed={selectedDate === key}
                  data-calendar-focus={index + 1 === month ? "true" : undefined}
                  disabled={key < lowerDate || key > upperDate} onClick={() => chooseDate(key)}
                  className={`rounded-xl border py-3 text-sm outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-30 ${selectedDate === key ? "border-blue-500 ring-1 ring-blue-500" : "border-transparent"}`}>
                  {label.slice(0, 3)}
                </button>;
              })}
            </div>
          ) : (
            <table className="w-full table-fixed border-collapse text-center" aria-label={`${MONTH_NAMES[month - 1]} ${year}`}>
              <thead><tr>{weekdays.map((day) => <th key={day} scope="col" className="pb-1 text-sm font-semibold text-slate-500">{day}</th>)}</tr></thead>
              <tbody>{Array.from({ length: days.length / 7 }, (_, week) => (
                <tr key={week}>{days.slice(week * 7, week * 7 + 7).map((day) => (
                  <td key={day.value} className="p-0">
                    <button type="button" data-date={day.value} data-calendar-focus={day.value === tabStop ? "true" : undefined}
                      tabIndex={day.value === tabStop ? 0 : -1}
                      aria-label={`${MONTH_NAMES[Number(day.value.slice(5, 7)) - 1]} ${day.day}, ${Number(day.value.slice(0, 4))}`}
                      aria-pressed={selectedDate === day.value} aria-current={day.value === todayKey ? "date" : undefined}
                      disabled={!isPickerValue(day.value) || day.value < lowerDate || day.value > upperDate}
                      onKeyDown={(event) => handleDayKey(event, day.value)}
                      onClick={() => chooseDate(day.value)}
                      className={`my-0.5 flex aspect-square w-full items-center justify-center rounded-xl border text-sm outline-none transition hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-25 ${selectedDate === day.value ? "border-blue-500 ring-1 ring-blue-500" : "border-transparent"} ${day.outside ? "text-slate-400" : "text-slate-900"}`}>
                      {day.day}
                    </button>
                  </td>
                ))}</tr>
              ))}</tbody>
            </table>
          )}

          {hasTime && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <label htmlFor={`${inputId}-time`} className="mb-2 block text-sm font-medium text-slate-600">Time</label>
              <input id={`${inputId}-time`} type="time" aria-label="Time" value={value.slice(11) || "00:00"}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => {
                  if (!event.target.value) return;
                  setDraft(null);
                  emitChange(`${isPickerValue(value, type) ? value.slice(0, 10) : current}T${event.target.value}`);
                }} />
              <Popover.Close asChild><button type="button" className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700">Done</button></Popover.Close>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
