"use client";

import { useEffect, useState } from "react";

type Settings = { notifications: boolean; time: string; reducedGraphics: boolean };
const KEY = "rost-settings-v1";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings>({ notifications: false, time: "09:00", reducedGraphics: false });
  const [permission, setPermission] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  useEffect(() => { try { const saved = localStorage.getItem(KEY); if (saved) setSettings(JSON.parse(saved)); } catch {} }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(settings)); document.documentElement.dataset.gardenQuality = settings.reducedGraphics ? "light" : "full"; }, [settings]);

  const requestSystemNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") setSettings((value) => ({ ...value, notifications: true }));
  };

  return <div className="modal-backdrop" role="presentation"><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <button className="modal-close" onClick={onClose} aria-label="Закрыть">×</button><p className="eyebrow">Твой комфорт</p><h2 id="settings-title">Настройки</h2>
    <div className="settings-group"><h3>Тёплые напоминания</h3><label className="settings-row"><span><b>Внутри приложения</b><small>Без давления и чувства вины</small></span><input type="checkbox" checked={settings.notifications} onChange={(event) => setSettings((value) => ({ ...value, notifications: event.target.checked }))} /></label><label className="settings-row"><span><b>Время</b><small>{Intl.DateTimeFormat().resolvedOptions().timeZone}</small></span><input type="time" value={settings.time} onChange={(event) => setSettings((value) => ({ ...value, time: event.target.value }))} /></label><button className="permission-button" onClick={requestSystemNotifications}>{permission === "granted" ? "Системные уведомления включены" : permission === "denied" ? "Разрешение отклонено в браузере" : "Разрешить системные уведомления"}</button></div>
    <div className="settings-group"><h3>Живой сад</h3><label className="settings-row"><span><b>Облегчённая графика</b><small>Меньше частиц и сложных эффектов на телефоне</small></span><input type="checkbox" checked={settings.reducedGraphics} onChange={(event) => setSettings((value) => ({ ...value, reducedGraphics: event.target.checked }))} /></label></div>
    <div className="install-note"><b>Приложение уже можно установить</b><p>В меню браузера выбери «Установить приложение» или «Добавить на главный экран». Marketplace не требуется.</p></div>
  </section></div>;
}

