import { expect } from 'chai';
import { loadEnv } from '../../configs/env';
import { readState, mergeState } from '../../configs/state';

/**
 * Interaction Test (Customer → Driver → Admin)
 *
 * This spec is a scaffold with shared state support.
 * Productionizing it requires a reliable way to capture a booking identifier
 * from the Customer app UI (bookingId or booking_number) and then search by that
 * in Driver/Admin.
 */

describe('Interaction - Customer books → Driver accepts → Admin sees', function () {
  this.timeout(25 * 60 * 1000);

  before(() => loadEnv());

  it('creates shared run state (scaffold)', async () => {
    const state = readState();
    // Example of what Customer test should write once it captures bookingId
    if (!state.bookingId) {
      mergeState({ createdAtIso: new Date().toISOString() });
    }

    expect(true).to.equal(true);
  });
});