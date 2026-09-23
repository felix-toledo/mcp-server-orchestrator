import QRCode from 'qrcode';
import { getTelegramStatus } from '../../../actions/get-telegram-status';
import { SettingsPanel } from '../../../components/settings/SettingsPanel';

export default async function SettingsPage() {
  const telegramStatus = await getTelegramStatus();
  const botLink = telegramStatus.botUsername ? `https://t.me/${telegramStatus.botUsername}` : null;
  const qrSvg = botLink ? await QRCode.toString(botLink, { type: 'svg', margin: 1, width: 160 }) : null;

  return <SettingsPanel telegramStatus={telegramStatus} botLink={botLink} qrSvg={qrSvg} />;
}
