const Regulator = artifacts.require("./Regulator.sol");
const TollBoothOperator = artifacts.require("./TollBoothOperator.sol");
const randomIntIn = require("../utils/randomIntIn.js");
const toBytes32 = require("../utils/toBytes32.js");
const {
  fromWei
} = web3.utils;

contract("Scenarios", function (accounts) {

  let regulator, operator, hashed1, hashed2;
  const [owner1, owner2, booth1, booth2, vehicle1, vehicle2, someone] = accounts;
  const vehicleType1 = randomIntIn(1, 1000);
  const vehicleType2 = vehicleType1 + randomIntIn(1, 1000);
  const multiplier1 = randomIntIn(1, 1000);
  const multiplier2 = multiplier1 + randomIntIn(1, 1000);
  const tmpSecret = randomIntIn(1, 1000);
  const secret1 = toBytes32(tmpSecret);
  const secret2 = toBytes32(tmpSecret + randomIntIn(1, 1000));
  const price01 = randomIntIn(1, 1000);
  const deposit1 = price01 + randomIntIn(1, 1000);
  const deposit2 = deposit1 + randomIntIn(1, 1000);

  before("Prepare, Deploy a new Regulator and set up two Vehicles.", async function () {
    assert.isAtLeast(accounts.length, 8);
    const owner1Bal = await web3.eth.getBalance(owner1);
    assert.isAtLeast(parseInt(fromWei(owner1Bal)), 10);
    regulator = await Regulator.new({
      from: owner1
    });
    await regulator.setVehicleType(vehicle1, vehicleType1, {
      from: owner1
    });
    await regulator.setVehicleType(vehicle2, vehicleType2, {
      from: owner1
    });
  });

  beforeEach("Deploy a new Operator, set up two Toll Booths, activate the instance and create 2 hashes.", async function () {
    const txObj = await regulator.createNewOperator(owner2, deposit1, {
      from: owner1
    });
    operator = await TollBoothOperator.at(txObj.logs[1].args.newOperator);
    await operator.addTollBooth(booth1, {
      from: owner2
    });
    await operator.addTollBooth(booth2, {
      from: owner2
    });
    await operator.setMultiplier(vehicleType1, multiplier1, {
      from: owner2
    });
    await operator.setMultiplier(vehicleType2, multiplier2, {
      from: owner2
    });
    await operator.setPaused(false, {
      from: owner2
    });
    hashed1 = await operator.hashSecret(secret1);
    hashed2 = await operator.hashSecret(secret2);
  });

  describe("Vehicle1 deposits required amount.", function () {

    beforeEach("Vehicle1 enters at booth1 and deposits required amount.", async function () {
      const success0 = await operator.enterRoad.call(
        booth1, hashed1, {
          from: vehicle1,
          value: (deposit1 * multiplier1)
        });
      assert.isTrue(success0);
      const tx0 = await operator.enterRoad(
        booth1, hashed1, {
          from: vehicle1,
          value: (deposit1 * multiplier1)
        });
      assert.strictEqual(tx0.receipt.logs.length, 1);
      assert.strictEqual(tx0.logs.length, 1);
      const logEntered0 = tx0.logs[0];
      assert.strictEqual(logEntered0.event, "LogRoadEntered");
      assert.strictEqual(logEntered0.args.vehicle, vehicle1);
      assert.strictEqual(logEntered0.args.entryBooth, booth1);
      assert.strictEqual(logEntered0.args.exitSecretHashed, hashed1);
      assert.strictEqual(logEntered0.args.multiplier.toNumber(), multiplier1);
      assert.strictEqual(logEntered0.args.depositedWeis.toNumber(), (deposit1 * multiplier1));
      const info2 = await operator.getVehicleEntry(hashed1);
      assert.strictEqual(info2[0], vehicle1);
      assert.strictEqual(info2[1], booth1);
      assert.strictEqual(info2[2].toNumber(), multiplier1);
      assert.strictEqual(info2[3].toNumber(), (deposit1 * multiplier1));
      const operatorBal0 = await web3.eth.getBalance(operator.address);
      const collected0 = await operator.getPayment(owner1);
      const vehicle1Due0 = await operator.getPayment(vehicle1);
      assert.strictEqual(operatorBal0, (deposit1 * multiplier1).toString(10));
      assert.strictEqual(collected0.toNumber(), 0);
      assert.strictEqual(vehicle1Due0.toNumber(), 0);
    });

    describe("Vehicle1 exits at booth2, which route price happens to be equal to the deposit amount. Vehicle1 should gets no refund.", function () {

      it("scenario 1", async function () {
        // Set the route price
        const success1 = await operator.setRoutePrice.call(booth1, booth2, deposit1, {
          from: owner2
        });
        assert.isTrue(success1);
        const tx1a = await operator.setRoutePrice(booth1, booth2, deposit1, {
          from: owner2
        });
        const logPriceSet1 = tx1a.logs[0];
        assert.strictEqual(logPriceSet1.event, "LogRoutePriceSet");
        assert.strictEqual(logPriceSet1.args.sender, owner2);
        assert.strictEqual(logPriceSet1.args.entryBooth, booth1);
        assert.strictEqual(logPriceSet1.args.exitBooth, booth2);
        assert.strictEqual(logPriceSet1.args.priceWeis.toNumber(), deposit1);

        // Get balances before Tx (result1)
        const vehicle1BalanceBefore1 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const owner2BalanceBefore1 = await operator.getPayment.call(owner2, {
          from: owner2
        });

        // Get balances expected
        const vehicle1BalanceExpected1 = vehicle1BalanceBefore1;
        const owner2BalanceExpected1 = owner2BalanceBefore1.toNumber() + deposit1 * multiplier1;

        // Report Exit Road
        const result1 = await operator.reportExitRoad.call(secret1, {
          from: booth2
        });
        assert.strictEqual(result1.toNumber(), 1);
        const tx1b = await operator.reportExitRoad(secret1, {
          from: booth2
        });
        const logExited1 = tx1b.logs[0];
        assert.strictEqual(logExited1.event, "LogRoadExited");
        assert.strictEqual(logExited1.args.exitBooth, booth2);
        assert.strictEqual(logExited1.args.exitSecretHashed, hashed1);
        assert.strictEqual(logExited1.args.finalFee.toNumber(), deposit1 * multiplier1);
        assert.strictEqual(logExited1.args.refundWeis.toNumber(), 0);

        // Get balances after Tx (result1)
        const vehicle1BalanceAfter1 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const owner2BalanceAfter1 = await operator.getPayment.call(owner2, {
          from: owner2
        });

        assert.strictEqual(vehicle1BalanceAfter1.toString(10), vehicle1BalanceExpected1.toString(10), "Should be 0.");
        assert.strictEqual(owner2BalanceAfter1.toString(10), owner2BalanceExpected1.toString(10), "Should receive the vehicle1 deposit.");
      });
    });

    describe("Vehicle1 exits at booth2, which route price happens to be more than the deposit amount. Vehicle1 should gets no refund.", function () {

      it("scenario 2", async function () {
        // Set the route price
        const success2 = await operator.setRoutePrice.call(booth1, booth2, deposit2, {
          from: owner2
        });
        assert.isTrue(success2);
        const tx2a = await operator.setRoutePrice(booth1, booth2, deposit2, {
          from: owner2
        });
        const logPriceSet2 = tx2a.logs[0];
        assert.strictEqual(logPriceSet2.event, "LogRoutePriceSet");
        assert.strictEqual(logPriceSet2.args.sender, owner2);
        assert.strictEqual(logPriceSet2.args.entryBooth, booth1);
        assert.strictEqual(logPriceSet2.args.exitBooth, booth2);
        assert.strictEqual(logPriceSet2.args.priceWeis.toNumber(), deposit2);

        // Get balances before Tx (result2)
        const vehicle1BalanceBefore2 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const owner2BalanceBefore2 = await operator.getPayment.call(owner2, {
          from: owner2
        });

        // Get balances expected
        const vehicle1BalanceExpected2 = vehicle1BalanceBefore2;
        const owner2BalanceExpected2 = owner2BalanceBefore2.toNumber() + deposit1 * multiplier1;

        // Report Exit Road
        const result2 = await operator.reportExitRoad.call(secret1, {
          from: booth2
        });
        assert.strictEqual(result2.toNumber(), 1);
        const tx2b = await operator.reportExitRoad(secret1, {
          from: booth2
        });
        const logExited2 = tx2b.logs[0];
        assert.strictEqual(logExited2.event, "LogRoadExited");
        assert.strictEqual(logExited2.args.exitBooth, booth2);
        assert.strictEqual(logExited2.args.exitSecretHashed, hashed1);
        assert.strictEqual(logExited2.args.finalFee.toNumber(), deposit1 * multiplier1);
        assert.strictEqual(logExited2.args.refundWeis.toNumber(), 0);

        // Get balances after Tx (result2)
        const vehicle1BalanceAfter2 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const owner2BalanceAfter2 = await operator.getPayment.call(owner2, {
          from: owner2
        });

        assert.strictEqual(vehicle1BalanceAfter2.toString(10), vehicle1BalanceExpected2.toString(10), "Should be 0.");
        assert.strictEqual(owner2BalanceAfter2.toString(10), owner2BalanceExpected2.toString(10), "Should receive the vehicle1 deposit.");
      });
    });

    describe("Vehicle1 exits at booth2, which route price happens to be less than the deposit amount. Vehicle1 should gets refunded the difference.", function () {

      it("scenario 3", async function () {
        // Set the route price
        const success3 = await operator.setRoutePrice.call(booth1, booth2, price01, {
          from: owner2
        });
        assert.isTrue(success3);
        const tx3a = await operator.setRoutePrice(booth1, booth2, price01, {
          from: owner2
        });
        const logPriceSet3 = tx3a.logs[0];
        assert.strictEqual(logPriceSet3.event, "LogRoutePriceSet");
        assert.strictEqual(logPriceSet3.args.sender, owner2);
        assert.strictEqual(logPriceSet3.args.entryBooth, booth1);
        assert.strictEqual(logPriceSet3.args.exitBooth, booth2);
        assert.strictEqual(logPriceSet3.args.priceWeis.toNumber(), price01);

        // Get balances before Tx (result3)
        const vehicle1BalanceBefore3 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const owner2BalanceBefore3 = await operator.getPayment.call(owner2, {
          from: owner2
        });

        // Get balances expected
        const vehicle1BalanceExpected3 = vehicle1BalanceBefore3.toNumber() + (deposit1 * multiplier1) - (price01 * multiplier1);
        const owner2BalanceExpected3 = owner2BalanceBefore3.toNumber() + price01 * multiplier1;

        // Report Exit Road
        const result3 = await operator.reportExitRoad.call(secret1, {
          from: booth2
        });
        assert.strictEqual(result3.toNumber(), 1);
        const tx3b = await operator.reportExitRoad(secret1, {
          from: booth2
        });
        const logExited3 = tx3b.logs[0];
        assert.strictEqual(logExited3.event, "LogRoadExited");
        assert.strictEqual(logExited3.args.exitBooth, booth2);
        assert.strictEqual(logExited3.args.exitSecretHashed, hashed1);
        assert.strictEqual(logExited3.args.finalFee.toNumber(), price01 * multiplier1);
        assert.strictEqual(logExited3.args.refundWeis.toNumber(), (deposit1 * multiplier1) - (price01 * multiplier1));

        // Get balances after Tx (result3)
        const vehicle1BalanceAfter3 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const owner2BalanceAfter3 = await operator.getPayment.call(owner2, {
          from: owner2
        });

        assert.strictEqual(vehicle1BalanceAfter3.toString(10), vehicle1BalanceExpected3.toString(10), "Should receive amount equal to deposit less routePrice.");
        assert.strictEqual(owner2BalanceAfter3.toString(10), owner2BalanceExpected3.toString(10), "Should receive amount equal to price01.");
      });
    });
  });

  describe("Vehicle1 deposits more than the required amount.", function () {

    beforeEach("Vehicle1 enters at booth1 and deposits more than the required amount.", async function () {
      const success0 = await operator.enterRoad.call(
        booth1, hashed1, {
          from: vehicle1,
          value: (deposit2 * multiplier1)
        });
      assert.isTrue(success0);
      const tx0 = await operator.enterRoad(
        booth1, hashed1, {
          from: vehicle1,
          value: (deposit2 * multiplier1)
        });
      assert.strictEqual(tx0.receipt.logs.length, 1);
      assert.strictEqual(tx0.logs.length, 1);
      const logEntered0 = tx0.logs[0];
      assert.strictEqual(logEntered0.event, "LogRoadEntered");
      assert.strictEqual(logEntered0.args.vehicle, vehicle1);
      assert.strictEqual(logEntered0.args.entryBooth, booth1);
      assert.strictEqual(logEntered0.args.exitSecretHashed, hashed1);
      assert.strictEqual(logEntered0.args.multiplier.toNumber(), multiplier1);
      assert.strictEqual(logEntered0.args.depositedWeis.toNumber(), (deposit2 * multiplier1));
      const info0 = await operator.getVehicleEntry(hashed1);
      assert.strictEqual(info0[0], vehicle1);
      assert.strictEqual(info0[1], booth1);
      assert.strictEqual(info0[2].toNumber(), multiplier1);
      assert.strictEqual(info0[3].toNumber(), (deposit2 * multiplier1));
      const operatorBal0 = await web3.eth.getBalance(operator.address);
      const collected0 = await operator.getPayment(owner1);
      const vehicle1Due0 = await operator.getPayment(vehicle1);
      assert.strictEqual(operatorBal0, (deposit2 * multiplier1).toString(10));
      assert.strictEqual(collected0.toNumber(), 0);
      assert.strictEqual(vehicle1Due0.toNumber(), 0);
    });

    describe("Vehicle1 exits at booth2, which route price happens to equal the deposit amount. Vehicle1 should gets refunded the difference.", function () {

      it("scenario 4", async function () {
        // Set the route price
        const success1 = await operator.setRoutePrice.call(booth1, booth2, deposit1, {
          from: owner2
        });
        assert.isTrue(success1);
        const tx1a = await operator.setRoutePrice(booth1, booth2, deposit1, {
          from: owner2
        });
        const logPriceSet1 = tx1a.logs[0];
        assert.strictEqual(logPriceSet1.event, "LogRoutePriceSet");
        assert.strictEqual(logPriceSet1.args.sender, owner2);
        assert.strictEqual(logPriceSet1.args.entryBooth, booth1);
        assert.strictEqual(logPriceSet1.args.exitBooth, booth2);
        assert.strictEqual(logPriceSet1.args.priceWeis.toNumber(), deposit1);

        // Get balances before Tx (result1)
        const vehicle1BalanceBefore1 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const owner2BalanceBefore1 = await operator.getPayment.call(owner2, {
          from: owner2
        });

        // Get balances expected
        const vehicle1BalanceExpected1 = vehicle1BalanceBefore1.toNumber() + (deposit2 * multiplier1) - (deposit1 * multiplier1);
        const owner2BalanceExpected1 = owner2BalanceBefore1.toNumber() + deposit1 * multiplier1;

        // Report Exit Road
        const result1 = await operator.reportExitRoad.call(secret1, {
          from: booth2
        });
        assert.strictEqual(result1.toNumber(), 1);
        const tx1b = await operator.reportExitRoad(secret1, {
          from: booth2
        });
        const logExited1 = tx1b.logs[0];
        assert.strictEqual(logExited1.event, "LogRoadExited");
        assert.strictEqual(logExited1.args.exitBooth, booth2);
        assert.strictEqual(logExited1.args.exitSecretHashed, hashed1);
        assert.strictEqual(logExited1.args.finalFee.toNumber(), deposit1 * multiplier1);
        assert.strictEqual(logExited1.args.refundWeis.toNumber(), (deposit2 * multiplier1) - (deposit1 * multiplier1));

        // Get balances after Tx (result1)
        const vehicle1BalanceAfter1 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const owner2BalanceAfter1 = await operator.getPayment.call(owner2, {
          from: owner2
        });

        assert.strictEqual(vehicle1BalanceAfter1.toString(10), vehicle1BalanceExpected1.toString(10), "Should be refunded with the difference.");
        assert.strictEqual(owner2BalanceAfter1.toString(10), owner2BalanceExpected1.toString(10), "Should receive the route price fee.");
      });
    });

    describe("Vehicle1 exits at booth2, which route price happens to be unknown. The operator's owner updates the route price, which happens to be less than the deposited amount. Vehicle1 should gets refunded the difference.", function () {

      it("scenario 5", async function () {
        // Get balances before Tx (tx2b)
        const vehicle1BalanceBefore2 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const owner2BalanceBefore2 = await operator.getPayment.call(owner2, {
          from: owner2
        });

        // Get balances expected
        const vehicle1BalanceExpected2 = vehicle1BalanceBefore2.toNumber() + (deposit2 * multiplier1) - (deposit1 * multiplier1);
        const owner2BalanceExpected2 = owner2BalanceBefore2.toNumber() + (deposit1 * multiplier1);

        // Report Exit Road
        const result2 = await operator.reportExitRoad.call(secret1, {
          from: booth2
        });
        assert.strictEqual(result2.toNumber(), 2);
        const tx2a = await operator.reportExitRoad(secret1, {
          from: booth2
        });
        assert.strictEqual(tx2a.logs.length, 1);
        const logPending2 = tx2a.logs[0];
        assert.strictEqual(logPending2.event, "LogPendingPayment");
        assert.strictEqual(logPending2.args.exitSecretHashed, hashed1);
        assert.strictEqual(logPending2.args.entryBooth, booth1);
        assert.strictEqual(logPending2.args.exitBooth, booth2);
        const info2 = await operator.getVehicleEntry(hashed1);
        const pendingCount2 = await operator.getPendingPaymentCount(booth1, booth2);
        assert.strictEqual(info2[0], vehicle1);
        assert.strictEqual(info2[1], booth1);
        assert.strictEqual(info2[2].toNumber(), multiplier1);
        assert.strictEqual(info2[3].toNumber(), (deposit2 * multiplier1));
        assert.strictEqual(pendingCount2.toNumber(), 1);

        // Set the route price to be less than the deposited amount
        const success2 = await operator.setRoutePrice.call(booth1, booth2, deposit1, {
          from: owner2
        });
        assert.isTrue(success2);
        const tx2b = await operator.setRoutePrice(booth1, booth2, deposit1, {
          from: owner2
        });
        const logPriceSet2 = tx2b.logs[0];
        assert.strictEqual(logPriceSet2.event, "LogRoutePriceSet");
        assert.strictEqual(logPriceSet2.args.sender, owner2);
        assert.strictEqual(logPriceSet2.args.entryBooth, booth1);
        assert.strictEqual(logPriceSet2.args.exitBooth, booth2);
        assert.strictEqual(logPriceSet2.args.priceWeis.toNumber(), deposit1);

        // Get balances after Tx (tx2b)
        const vehicle1BalanceAfter2 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const owner2BalanceAfter2 = await operator.getPayment.call(owner2, {
          from: owner2
        });

        assert.strictEqual(vehicle1BalanceAfter2.toString(10), vehicle1BalanceExpected2.toString(10), "Should be refunded with the difference.");
        assert.strictEqual(owner2BalanceAfter2.toString(10), owner2BalanceExpected2.toString(10), "Should receive the route price fee.");
      });
    });

    describe("Vehicle1 exits at booth2, which route price happens to be unknown. Vehicle2 enters at booth1 and deposits the exact required amount. Vehicle2 exits at booth2, which route price happens to be unknown. The operator's owner updates the route price, which happens to be less than the required deposit. Vehicle1 should gets refunded the difference. Someone (anyone) calls to clear one pending payment. Vehicle2 should gets refunded the difference.", function () {

      it("scenario 6", async function () {
        // Get balances of vehicle1, vehicle2 and the owner2 before the txs
        const vehicle1BalanceBefore3 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const vehicle2BalanceBefore3 = await operator.getPayment.call(vehicle2, {
          from: owner2
        });
        const owner2BalanceBefore3 = await operator.getPayment.call(owner2, {
          from: owner2
        });

        // Get balances of owner2 and the vehicle1 expected after setting the route price
        const vehicle1BalanceExpected3 = vehicle1BalanceBefore3.toNumber() + (deposit2 * multiplier1) - (deposit1 * multiplier1);
        const owner2BalanceExpected3a = owner2BalanceBefore3.toNumber() + deposit1 * multiplier1;

        // Get balance of vehicle2 expected after the call to clear one pending payment
        const vehicle2BalanceExpected3 = vehicle2BalanceBefore3.toNumber() + (deposit2 * multiplier2) - (deposit1 * multiplier2);

        // Report Exit Road Vehicle1
        const result3 = await operator.reportExitRoad.call(secret1, {
          from: booth2
        });
        assert.strictEqual(result3.toNumber(), 2);
        const tx3a = await operator.reportExitRoad(secret1, {
          from: booth2
        });
        assert.strictEqual(tx3a.logs.length, 1);
        const logPending3a = tx3a.logs[0];
        assert.strictEqual(logPending3a.event, "LogPendingPayment");
        assert.strictEqual(logPending3a.args.exitSecretHashed, hashed1);
        assert.strictEqual(logPending3a.args.entryBooth, booth1);
        assert.strictEqual(logPending3a.args.exitBooth, booth2);
        const info3a = await operator.getVehicleEntry(hashed1);
        const pendingCount3a = await operator.getPendingPaymentCount(booth1, booth2);
        assert.strictEqual(info3a[0], vehicle1);
        assert.strictEqual(info3a[1], booth1);
        assert.strictEqual(info3a[2].toNumber(), multiplier1);
        assert.strictEqual(info3a[3].toNumber(), (deposit2 * multiplier1));
        assert.strictEqual(pendingCount3a.toNumber(), 1);

        //Vehicle2 enters at booth1 and deposits the exact required amount
        const success3a = await operator.enterRoad.call(
          booth1, hashed2, {
            from: vehicle2,
            value: (deposit2 * multiplier2)
          });
        assert.isTrue(success3a);
        const tx3b = await operator.enterRoad(
          booth1, hashed2, {
            from: vehicle2,
            value: (deposit2 * multiplier2)
          });
        assert.strictEqual(tx3b.receipt.logs.length, 1);
        assert.strictEqual(tx3b.logs.length, 1);
        const logEntered3 = tx3b.logs[0];
        assert.strictEqual(logEntered3.event, "LogRoadEntered");
        assert.strictEqual(logEntered3.args.vehicle, vehicle2);
        assert.strictEqual(logEntered3.args.entryBooth, booth1);
        assert.strictEqual(logEntered3.args.exitSecretHashed, hashed2);
        assert.strictEqual(logEntered3.args.multiplier.toNumber(), multiplier2);
        assert.strictEqual(logEntered3.args.depositedWeis.toNumber(), (deposit2 * multiplier2));

        // Report Exit Road Vehicle2
        const result4 = await operator.reportExitRoad.call(secret2, {
          from: booth2
        });
        assert.strictEqual(result4.toNumber(), 2);
        const tx3c = await operator.reportExitRoad(secret2, {
          from: booth2
        });
        assert.strictEqual(tx3c.logs.length, 1);
        const logPending3b = tx3c.logs[0];
        assert.strictEqual(logPending3b.event, "LogPendingPayment");
        assert.strictEqual(logPending3b.args.exitSecretHashed, hashed2);
        assert.strictEqual(logPending3b.args.entryBooth, booth1);
        assert.strictEqual(logPending3b.args.exitBooth, booth2);
        const info3b = await operator.getVehicleEntry(hashed2);
        const pendingCount3b = await operator.getPendingPaymentCount(booth1, booth2);
        assert.strictEqual(info3b[0], vehicle2);
        assert.strictEqual(info3b[1], booth1);
        assert.strictEqual(info3b[2].toNumber(), multiplier2);
        assert.strictEqual(info3b[3].toNumber(), (deposit2 * multiplier2));
        assert.strictEqual(pendingCount3b.toNumber(), 2);

        // Set the route price to be less than the required deposit
        const success3b = await operator.setRoutePrice.call(booth1, booth2, deposit1, {
          from: owner2
        });
        assert.isTrue(success3b);
        const tx3d = await operator.setRoutePrice(booth1, booth2, deposit1, {
          from: owner2
        });
        const logPriceSet3c = tx3d.logs[0];
        assert.strictEqual(logPriceSet3c.event, "LogRoutePriceSet");
        assert.strictEqual(logPriceSet3c.args.sender, owner2);
        assert.strictEqual(logPriceSet3c.args.entryBooth, booth1);
        assert.strictEqual(logPriceSet3c.args.exitBooth, booth2);
        assert.strictEqual(logPriceSet3c.args.priceWeis.toNumber(), deposit1);
        const pendingCount3c = await operator.getPendingPaymentCount(booth1, booth2);
        assert.strictEqual(pendingCount3c.toNumber(), 1);

        const logExited3a = tx3d.logs[1];
        assert.strictEqual(logExited3a.event, "LogRoadExited");
        assert.strictEqual(logExited3a.args.exitBooth, booth2);
        assert.strictEqual(logExited3a.args.exitSecretHashed, hashed1);
        assert.strictEqual(logExited3a.args.finalFee.toNumber(), deposit1 * multiplier1);
        assert.strictEqual(
          logExited3a.args.refundWeis.toNumber(),
          (deposit2 * multiplier1) - (deposit1 * multiplier1));

        // Get balances after set the route price
        const vehicle1BalanceAfter3 = await operator.getPayment.call(vehicle1, {
          from: owner2
        });
        const owner2BalanceAfter3a = await operator.getPayment.call(owner2, {
          from: owner2
        });

        // Get balances expected after clearSomePendingPayments
        const owner2BalanceExpected3b = owner2BalanceAfter3a.toNumber() + (deposit1 * multiplier2);

        assert.strictEqual(vehicle1BalanceAfter3.toString(10), vehicle1BalanceExpected3.toString(10), "Should be refunded with the difference.");
        assert.strictEqual(owner2BalanceAfter3a.toString(10), owner2BalanceExpected3a.toString(10), "Should receive the route price fee.");

        // clearSomePendingPayments
        const success3d = await operator.clearSomePendingPayments.call(booth1, booth2, 1, {
          from: someone
        });
        assert.isTrue(success3d);
        const tx3e = await operator.clearSomePendingPayments(booth1, booth2, 1, {
          from: someone
        });
        assert.strictEqual(tx3e.receipt.logs.length, 1);
        assert.strictEqual(tx3e.logs.length, 1);
        const logExited3b = tx3e.logs[0];
        assert.strictEqual(logExited3b.event, "LogRoadExited");
        assert.strictEqual(logExited3b.args.exitBooth, booth2);
        assert.strictEqual(logExited3b.args.exitSecretHashed, hashed2);
        assert.strictEqual(logExited3b.args.finalFee.toNumber(), deposit1 * multiplier2);
        assert.strictEqual(
          logExited3b.args.refundWeis.toNumber(),
          (deposit2 * multiplier2) - (deposit1 * multiplier2));
        const pendingCount3d = await operator.getPendingPaymentCount(booth1, booth2);
        assert.strictEqual(pendingCount3d.toNumber(), 0);

        // Get balances after clearSomePendingPayments
        const vehicle2BalanceAfter3 = await operator.getPayment.call(vehicle2, {
          from: owner2
        });
        const owner2BalanceAfter3b = await operator.getPayment.call(owner2, {
          from: owner2
        });

        assert.strictEqual(vehicle2BalanceAfter3.toString(10), vehicle2BalanceExpected3.toString(10), "Should be refunded with the difference.");
        assert.strictEqual(owner2BalanceAfter3b.toString(10), owner2BalanceExpected3b.toString(10), "Should receive the route price fee.");
      });
    });
  });
});