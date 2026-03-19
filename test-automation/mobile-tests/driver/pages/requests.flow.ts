import type { Browser } from 'webdriverio';
import { tapByAny, waitForAny } from '../../support/selectors';

export class DriverRequestsFlow {
  constructor(private driver: Browser<'async'>) {}

  async goOnline() {
    await tapByAny(this.driver, ['~driver.toggleOnline', 'android=new UiSelector().textContains("Online")'], 30_000);
  }

  async openRequestsTab() {
    await tapByAny(this.driver, ['~driver.viewRequestsButton', '~driver.tab.requests', 'android=new UiSelector().textContains("Requests")']);
    await waitForAny(this.driver, ['~requests.list', 'android=new UiSelector().textContains("PICKUP")'], 60_000);
  }

  async acceptFirstRequest() {
    await tapByAny(this.driver, ['~request.card.0', 'android=new UiSelector().textContains("PICKUP")'], 60_000);
    await tapByAny(this.driver, ['~request.accept.0', 'android=new UiSelector().textContains("Accept")'], 30_000);
    await waitForAny(this.driver, ['~driver.activeRide', 'android=new UiSelector().textContains("Arrived")', 'android=new UiSelector().textContains("Navigate")'], 60_000);
  }
}
