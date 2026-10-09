import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  consumeOAuthReturn, isSafeConsentPath, isSafeContinueUrl, rememberOAuthReturn,
} from '../lib/oauthReturn';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from '../pages/LoginPage';
import AuthCallback from '../pages/AuthCallback';
import { LocationDisplay } from '../testUtils/renderWithProviders';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn(), api: {} }));
jest.mock('../i18n', () => ({ useLanguage: () => ({ language: 'fr' }) }));

const CONSENT = '/oauth/consent?request=req_ABCdef0123456789xyz';

const ORIGINAL_BACKEND = process.env.REACT_APP_BACKEND_URL;

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  process.env.REACT_APP_BACKEND_URL = 'https://jobtracker.maadec.com';
});

afterAll(() => {
  process.env.REACT_APP_BACKEND_URL = ORIGINAL_BACKEND;
});

describe('retour sûr vers le consentement OAuth', () => {
  test('mémorise et restitue une seule fois un chemin de consentement', () => {
    expect(rememberOAuthReturn(CONSENT)).toBe(true);
    expect(consumeOAuthReturn()).toBe(CONSENT);
    expect(consumeOAuthReturn()).toBeNull();
  });

  test.each([
    'https://evil.example/oauth/consent?request=req_ABCdef0123456789xyz',
    '//evil.example/oauth/consent?request=req_ABCdef0123456789xyz',
    '/dashboard',
    '/oauth/consent?request=court',
    '/oauth/consent?request=req_ABCdef0123456789xyz&next=https://evil.example',
    '/oauth/consent?request=req_ABCdef0123456789xyz#frag',
    '/OAUTH/consent?request=req_ABCdef0123456789xyz',
  ])('refuse tout autre chemin : %s', (path) => {
    expect(isSafeConsentPath(path)).toBe(false);
    expect(rememberOAuthReturn(path)).toBe(false);
    expect(consumeOAuthReturn()).toBeNull();
  });

  test('une valeur falsifiée en stockage est ignorée', () => {
    sessionStorage.setItem('jt_oauth_return', JSON.stringify({ path: 'https://evil.example', at: Date.now() }));
    expect(consumeOAuthReturn()).toBeNull();
    sessionStorage.setItem('jt_oauth_return', 'pas du json');
    expect(consumeOAuthReturn()).toBeNull();
  });

  test('expire après 15 minutes', () => {
    const now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
    rememberOAuthReturn(CONSENT);
    spy.mockReturnValue(now + 15 * 60 * 1000 + 1);
    expect(consumeOAuthReturn()).toBeNull();
    spy.mockRestore();
  });

  test('développement local : origine du backend configuré acceptée', () => {
    process.env.REACT_APP_BACKEND_URL = 'http://localhost:8001';
    expect(isSafeContinueUrl('http://localhost:8001/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC')).toBe(true);
    expect(isSafeContinueUrl('http://localhost:9999/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC')).toBe(false);
  });

  test.each([
    ['https://jobtracker.maadec.com/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC', true],
    ['https://evil.example/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC', false],
    ['https://jobtracker.maadec.com.evil.example/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC', false],
    ['http://jobtracker.maadec.com/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC', false],
    ['https://jobtracker.maadec.com/api/oauth/continue?ticket=a&code=x', false],
    ['https://user:pw@jobtracker.maadec.com/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC', false],
    ['https://jobtracker.maadec.com/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC#x', false],
    ['/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC', false],
    [null, false],
  ])('URL de continuation %s -> %s', (url, expected) => {
    expect(isSafeContinueUrl(url)).toBe(expected);
  });
});

const renderAt = (element, route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={route.split('#')[0].split('?')[0]} element={element} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  );

describe('retour après connexion', () => {
  test('connexion par mot de passe : retour vers la demande de consentement', async () => {
    useAuth.mockReturnValue({ login: jest.fn().mockResolvedValue({ success: true }), loginWithGoogle: jest.fn(), loading: false });
    rememberOAuthReturn(CONSENT);
    renderAt(<LoginPage />, '/login');
    await userEvent.type(screen.getByTestId('login-email'), 'owner@jobtracker.test');
    await userEvent.type(screen.getByTestId('login-password'), 'motdepasse123');
    await userEvent.click(screen.getByTestId('login-submit'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(CONSENT));
  });

  test('connexion par mot de passe sans demande en cours : tableau de bord', async () => {
    useAuth.mockReturnValue({ login: jest.fn().mockResolvedValue({ success: true }), loginWithGoogle: jest.fn(), loading: false });
    renderAt(<LoginPage />, '/login');
    await userEvent.type(screen.getByTestId('login-email'), 'owner@jobtracker.test');
    await userEvent.type(screen.getByTestId('login-password'), 'motdepasse123');
    await userEvent.click(screen.getByTestId('login-submit'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard'));
  });

  test('connexion Google : retour vers la demande de consentement', async () => {
    useAuth.mockReturnValue({
      handleGoogleCallback: jest.fn().mockResolvedValue({ success: true, user: { onboarding_completed: false } }),
    });
    rememberOAuthReturn(CONSENT);
    renderAt(<AuthCallback />, '/auth/callback#session_id=abc');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(CONSENT));
  });
});
