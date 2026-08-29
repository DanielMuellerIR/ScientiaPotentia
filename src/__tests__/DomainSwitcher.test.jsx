import React from 'react';
import {
  cleanup, fireEvent, render, screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DomainSwitcher from '../components/DomainSwitcher';
import { DOMAINS } from '../domains';

afterEach(cleanup);

describe('DomainSwitcher', () => {
  it('verknüpft Trigger und Menü, bietet alle Domains an und unterstützt Auswahl sowie Escape', () => {
    const onSelect = vi.fn();
    render(
      <DomainSwitcher
        domains={DOMAINS}
        activeId="terra"
        onSelect={onSelect}
        srsProgress={{
          DE: { repetitions: 2 },
          'astra:mars': { repetitions: 1, domain: 'astra' },
        }}
      />
    );

    const trigger = screen.getByRole('button', {
      name: 'Wissensbereich wechseln, aktuell Terra: Geografie',
    });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');

    fireEvent.click(trigger);

    const menuId = trigger.getAttribute('aria-controls');
    expect(menuId).toBeTruthy();
    const menu = screen.getByRole('menu', { name: 'Wissensbereiche' });
    expect(menu).toHaveAttribute('id', menuId);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const options = screen.getAllByRole('menuitemradio');
    expect(options).toHaveLength(9);
    expect(screen.getByRole('menuitemradio', { name: /Terra/ }))
      .toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: /Terra/ })).toHaveFocus();
    expect(screen.getByRole('menuitemradio', { name: /Astra/ }))
      .toHaveAttribute('aria-checked', 'false');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio', { name: /Astra/ })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('menuitemradio', { name: /Historia/ })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(screen.getByRole('menuitemradio', { name: /Scientia/ })).toHaveFocus();

    fireEvent.click(screen.getByRole('menuitemradio', { name: /Astra/ }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('astra');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    const astraOption = screen.getByRole('menuitemradio', { name: /Astra/ });
    astraOption.focus();
    expect(astraOption).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('markiert bei einer unbekannten aktiven ID den sichtbaren Fallback als aktiv', () => {
    render(
      <DomainSwitcher
        domains={DOMAINS}
        activeId="entfernte-domain"
        onSelect={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', {
      name: 'Wissensbereich wechseln, aktuell Scientia: Alle Bereiche außer Geografie',
    }));

    expect(screen.getByRole('menuitemradio', { name: /Scientia/ }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('schließt das Menü, wenn Tab den Bereichsschalter verlässt', () => {
    render(
      <div>
        <DomainSwitcher
          domains={DOMAINS}
          activeId="terra"
          onSelect={vi.fn()}
        />
        <button type="button">Nächstes Element</button>
      </div>
    );

    fireEvent.click(screen.getByRole('button', {
      name: 'Wissensbereich wechseln, aktuell Terra: Geografie',
    }));
    const nextButton = screen.getByRole('button', { name: 'Nächstes Element' });
    fireEvent.blur(screen.getByRole('menuitemradio', { name: /Terra/ }), {
      relatedTarget: nextButton,
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
