import { api, apiError } from '../api/client';
import { useFetch, fmtDate, notifyNotificationsChanged } from '../lib/hooks';
import type { Notification } from '../types';

export default function Notifications() {
  const { data: items, refetch } = useFetch<Notification[]>('/notifications');

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      refetch();
      notifyNotificationsChanged();
    } catch (e) {
      alert(apiError(e));
    }
  }
  async function markAll() {
    await api.patch('/notifications/read-all');
    refetch();
    notifyNotificationsChanged();
  }
  async function generate() {
    try {
      await api.post('/notifications/generate-reminders');
      refetch();
      notifyNotificationsChanged();
    } catch (e) {
      alert(apiError(e));
    }
  }

  return (
    <>
      <div className="between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Notifications</h2>
        <div className="flex">
          <button className="btn ghost sm" onClick={generate}>Check dues now</button>
          <button className="btn gray sm" onClick={markAll}>Mark all read</button>
        </div>
      </div>

      <div className="panel">
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Title</th>
                <th>Details</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items?.map((n) => (
                <tr key={n.id} style={{ fontWeight: n.isRead ? 400 : 600 }}>
                  <td>{n.isRead ? '' : '🔴'}</td>
                  <td>{n.title}</td>
                  <td className="muted" style={{ fontWeight: 400 }}>{n.body}</td>
                  <td className="muted" style={{ fontWeight: 400 }}>{fmtDate(n.createdAt)}</td>
                  <td className="right">
                    {!n.isRead && (
                      <button className="btn sm ghost" onClick={() => markRead(n.id)}>Read</button>
                    )}
                  </td>
                </tr>
              ))}
              {items?.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: 16 }}>No notifications.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
