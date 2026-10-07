import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from 'date-fns';
import { ApplicationSentDate } from '../components/applications/ApplicationSentDate';
import { SentDateDialog, sentDateToIso } from '../components/applications/SentDateDialog';
import { STATUS_MAP, getStatusOptionsFor, isToApply } from '../constants/application';

jest.mock('../i18n', () => ({ useLanguage: () => ({ language: 'fr' }) }));

const today = format(new Date(), 'yyyy-MM-dd');

describe('statut to_apply', () => {
  test('libellé « À postuler »', () => {
    expect(STATUS_MAP.to_apply.label).toBe('À postuler');
    expect(isToApply({ reponse: 'to_apply' })).toBe(true);
    expect(isToApply({ reponse: 'pending' })).toBe(false);
  });

  test('menu rapide : depuis to_apply, seul « En attente » est proposé', () => {
    expect(getStatusOptionsFor('to_apply').map(s => s.value)).toEqual(['pending', 'to_apply']);
    expect(getStatusOptionsFor('pending').length).toBeGreaterThan(2);
  });

  test("la date technique n'est jamais présentée comme date de candidature", () => {
    render(
      <ApplicationSentDate
        app={{ reponse: 'to_apply', date_candidature: '2026-10-07T08:00:00+00:00', created_at: '2026-10-05T08:00:00+00:00' }}
        pattern="dd/MM/yyyy"
      />
    );
    const node = screen.getByTestId('application-not-sent');
    expect(node).toHaveTextContent('Pas encore envoyée');
    expect(node).toHaveTextContent('ajoutée le 05/10/2026');
    expect(node).not.toHaveTextContent('07/10/2026');
  });

  test('une candidature envoyée affiche sa date', () => {
    render(<ApplicationSentDate app={{ reponse: 'pending', date_candidature: '2026-09-01T12:00:00+00:00' }} pattern="dd/MM/yyyy" />);
    expect(screen.getByText('01/09/2026')).toBeInTheDocument();
  });

  test('sentDateToIso conserve le jour choisi', () => {
    const iso = sentDateToIso('2026-09-30');
    expect(format(new Date(iso), 'yyyy-MM-dd')).toBe('2026-09-30');
  });
});

describe('SentDateDialog', () => {
  test("préremplie à aujourd'hui, annulation sans envoi", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<SentDateDialog isOpen onCancel={onCancel} onConfirm={onConfirm} />);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Candidature envoyée' })).toBeInTheDocument();
    expect(within(dialog).getByText('À quelle date avez-vous envoyé cette candidature ?')).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Date d'envoi")).toHaveValue(today);

    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('confirmation avec la date choisie', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(<SentDateDialog isOpen onCancel={jest.fn()} onConfirm={onConfirm} />);

    const input = await screen.findByLabelText("Date d'envoi");
    await user.clear(input);
    await user.type(input, '2026-09-28');
    await user.click(screen.getByTestId('sent-date-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('2026-09-28');
  });

  test('une date future est refusée', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(<SentDateDialog isOpen onCancel={jest.fn()} onConfirm={onConfirm} />);

    const input = await screen.findByLabelText("Date d'envoi");
    await user.clear(input);
    await user.type(input, '2999-01-01');
    expect(screen.getByTestId('sent-date-confirm')).toBeDisabled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('pendant l’enregistrement, la confirmation est désactivée', async () => {
    render(<SentDateDialog isOpen loading onCancel={jest.fn()} onConfirm={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('sent-date-confirm')).toBeDisabled());
  });
});
