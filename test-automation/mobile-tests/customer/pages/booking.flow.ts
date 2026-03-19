import type { Browser } from 'webdriverio';
import { tapByAny, typeByAny, waitForAny } from '../../support/selectors';

export class CustomerBookingFlow {
  constructor(private driver: Browser<'async'>) {}

  async startNewBooking() {
    await tapByAny(this.driver, ['~customer.startRideButton', 'android=new UiSelector().textContains("Find")', 'android=new UiSelector().textContains("Ride")']);
    await waitForAny(this.driver, ['~ride.pickupInput', 'android=new UiSelector().textContains("Pickup")'], 60_000);
  }

  async setPickupAndDrop(pickupQuery: string, dropQuery: string) {
    await typeByAny(this.driver, ['~ride.pickupInput'], pickupQuery);
    await tapByAny(this.driver, ['~ride.pickupFirstSuggestion', `android=new UiSelector().textContains("${pickupQuery.split(' ')[0]}")`]);

    await typeByAny(this.driver, ['~ride.dropInput'], dropQuery);
    await tapByAny(this.driver, ['~ride.dropFirstSuggestion', `android=new UiSelector().textContains("${dropQuery.split(' ')[0]}")`]);

    await tapByAny(this.driver, ['~ride.nextToReceiverDetails', 'android=new UiSelector().textContains("Next")']);
  }

  async setReceiverDetails(name: string, phone10Digits: string) {
    await typeByAny(this.driver, ['~receiver.nameInput'], name);
    await typeByAny(this.driver, ['~receiver.phoneInput'], phone10Digits);
    await tapByAny(this.driver, ['~receiver.nextToVehicle', 'android=new UiSelector().textContains("Vehicle")']);
  }

  async chooseFirstVehicleAndBook() {
    await tapByAny(this.driver, ['~vehicle.option.0', 'android=new UiSelector().textContains("â‚¹")'], 60_000);
    await tapByAny(this.driver, ['~payment.method.wallet', '~payment.method.cash'], 20_000);
    await tapByAny(this.driver, ['~booking.confirmButton', 'android=new UiSelector().textContains("Book")']);

    await waitForAny(this.driver, ['~booking.waiting', 'android=new UiSelector().textContains("Finding")', 'android=new UiSelector().textContains("Driver")'], 60_000);
  }
}
