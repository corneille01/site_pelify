import React from 'react';
import type { AppNotification } from '../types';
import { fmtDate, go } from '../lib';
import { Modal, btnGhost } from './Ui';

export const NotificationsPanel: React.FC<{ list: AppNotification[]; onClose: () => void; onRead: (id?: string) => void }> = ({ list, onClose, onRead }) => (
  <Modal title="Notifications" onClose={onClose}>
    {list.length === 0 ? <p className="text-[#dde4f0]">Aucune notification pour le moment.</p> : (
      <>
        <button type="button" className={btnGhost} onClick={() => onRead()} disabled={list.every((n) => n.read)}>Tout marquer comme lu</button>
        <ul className="divide-y divide-[#2c2c44] -mx-5">
          {list.map((n) => (
            <li key={n.id} className={`px-5 py-3 ${n.read ? '' : 'bg-[rgba(0,255,204,0.06)]'}`}>
              <a
                href={n.link}
                className="block"
                onClick={(e) => {
                  e.preventDefault();
                  onRead(n.id);
                  onClose();
                  const rel = n.link.replace(/^\/arena\/jouer/, '') || '/';
                  go(rel);
                }}
              >
                <p className={`text-sm ${n.read ? 'text-white' : 'font-bold text-[#00ffcc]'}`}>{n.title}</p>
                <p className="text-sm text-[#dde4f0] mt-0.5">{n.body}</p>
                <p className="text-xs text-[#aab3c5] mt-1">{fmtDate(n.timestamp)}</p>
              </a>
            </li>
          ))}
        </ul>
      </>
    )}
  </Modal>
);
