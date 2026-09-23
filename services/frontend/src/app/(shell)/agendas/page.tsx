import { listAgendas } from '../../../actions/list-agendas';
import { AgendaList } from '../../../components/agendas/AgendaList';

export default async function AgendasPage() {
  const reminders = await listAgendas();
  return <AgendaList reminders={reminders} />;
}
