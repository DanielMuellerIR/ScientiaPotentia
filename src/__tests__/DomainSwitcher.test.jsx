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
    expect(screen.getByRole('menuitemradio', { name: /Astra/ }))
      .toHaveAttribute('aria-checked', 'false');

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
});
