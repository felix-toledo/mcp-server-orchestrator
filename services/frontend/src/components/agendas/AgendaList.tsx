import type { Reminder } from '../../actions/list-agendas';

function describeSchedule(reminder: Reminder): string {
  if (reminder.scheduleType === 'RECURRING') {
    return `recurrente: ${reminder.cronExpression}`;
  }
  return reminder.scheduledAt ? `una vez: ${reminder.scheduledAt}` : 'una vez';
}

export function AgendaList({ reminders }: { reminders: Reminder[] }) {
  return (
    <section className="agenda-list">
      <div className="agenda-list__header">
        <h2 className="text-heading">Agendas</h2>
        <p className="text-caption">Pedile a ALMA por chat que te recuerde algo — acá vas a ver lo que quedó agendado.</p>
      </div>

      {reminders.length === 0 ? (
        <p className="card card--empty">Todavía no tenés recordatorios.</p>
      ) : (
        <ul className="agenda-list__items">
          {reminders.map((reminder) => (
            <li key={reminder.id} className="card agenda-list__item">
              <p className="text-body-strong">{reminder.actionDescription}</p>
              <p className="text-mono-sm">{describeSchedule(reminder)}</p>
              {reminder.lastDeliveryStatus && (
                <span className="chip">
                  {reminder.lastDeliveryStatus === 'DELIVERED' ? '✓ entregado' : '⚠ falló la entrega'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
