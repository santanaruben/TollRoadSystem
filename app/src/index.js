import 'bootstrap/dist/css/bootstrap.min.css';
import './css/custom.css';
import 'bootstrap/dist/js/bootstrap.min.js';
import './js/validations.js';
const Web3 = require("web3");
const TruffleContract = require("truffle-contract");
const $ = require("jquery");

// Our built contract
const regulatorJSON = require("../../build/contracts/Regulator.json");
const tboJSON = require("../../build/contracts/TollBoothOperator.json");

const App = {
  web3: null,
  account: null,
  Regulator: null,
  TollBoothOperator: null,
  TBO: null,
  TBOforVehicles: null,
  TBOforTollBooths: null,
  TBOforLogs: null,
  entries: [],
  isRegulator: false,
  isOperator: false,
  isTollBooth: false,
  isVehicle: false,
  subscriptions: [],

  // Initial functions

  initWeb3: async function () {
    if (window.ethereum) {
      App.web3 = new Web3(window.ethereum);
      window.ethereum.enable(); // get permission to access accounts
    } else {
      console.warn(
        "No web3 detected. Falling back to http://0.0.0.0:8545.",
      );
      // App.web3 = await new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
      App.web3 = await new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));
    }
    return this.initContract();
  },

  initContract: async function () {
    try {
      this.Regulator = TruffleContract(regulatorJSON);
      this.Regulator.setProvider(App.web3.currentProvider);
      this.TollBoothOperator = TruffleContract(tboJSON);
      this.TollBoothOperator.setProvider(App.web3.currentProvider);

      // this.currentAccount();
      this.getAccountsForTBO();
      this.getOperatorsForLogs();

      this.LogVehicleTypeSet();
      this.LogTollBoothOperatorCreated();
      this.bindEvents();
    } catch (error) {
      console.log(error);
      console.error("Could not connect to contract or chain.");
    }
  },

  currentAccount: async function () {
    const accounts = await App.web3.eth.getAccounts();
    App.account = accounts[0];
    await App.getOperatorsForLogs();
    await App.checkRegulator();
    document.getElementById("yourAddress").innerHTML = App.account;
    await App.updateBalanceSender();
    window.ethereum.on('accountsChanged', async function (accounts) {
      $("#txStatusUp").empty();
      App.account = accounts[0];
      await App.checkRegulator();
      await App.getOperators();
      document.getElementById("yourAddress").innerHTML = App.account;
      await App.updateBalanceSender();
      if ($("#nav-vehicle-tab").hasClass("active")) {
        await App.getOperatorsForVehicles();
      }
      if ($("#nav-tollBooth-tab").hasClass("active")) {
        await App.getOperatorsForTollBooths();
        await App.checkTollBooth();
      }      
    })
  },

  checkRegulator: function () {
    var regulator;
    App.Regulator.deployed().then(function (instance) {
      regulator = instance;
      return regulator.getOwner()
    }).then(async function (regulatorAddress) {
      App.isRegulator = regulatorAddress.toLowerCase() == App.account.toLowerCase();
      await App.regulatorActivity(App.isRegulator);
    }).catch(function (err) {
      console.log(err);
    });
  },

  checkTollBooth: function () {
    App.TBOforTollBooths.isTollBooth(App.account)
    .then(async function (TollBooth) {
        App.isTollBooth = TollBooth;
        await App.tollBoothActivity(App.isTollBooth);
    }).catch(function (err) {
      console.log(err);
    });
  },

  updateBalanceContract: function () {
    try {
      var contractAddress = $("#operators").val();
      App.web3.eth.getBalance(contractAddress, async function (err, result) {
        let element = document.getElementById("amountContract");
        element.innerHTML = "Contract Balance "+result+" WEI's";
        element.title = App.web3.utils.fromWei(result, "ether") + " ETH";        
    await App.checkActivity();
      })
    } catch(err) {
      console.log(err.message);
    };
  },

  checkActivity: async function () {
    try {
      let isPaused = await App.TBO.isPaused();
      if (isPaused) {
        $("#activity").empty();
        $("#activity").append(`<span class="logoText badge badge-pill badge-warning">contract in pause</span>`);
      } else {
        $("#activity").empty();
        $("#activity").append(`<span class="logoText badge badge-pill badge-success">contract active</span>`);
      }
    } catch(err) {
      console.log(err);
    };
  },

  pauseResume: async function() {
    let isPaused = await App.TBO.isPaused();
    if (isPaused) {
    const success = await App.TBO.setPaused.call(false, {
      from: App.account
    })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await App.TBO.setPaused(false, {
        from: App.account
      })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "You just resumed the operator contract", 1000);
        App.updateBalanceSender();
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });
    }
    else 
    {
      const success = await App.TBO.setPaused.call(true, {
        from: App.account
      })
      if (!success) {
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
        throw new Error("The transaction will fail, not sending");
      }
      const txObj = await App.TBO.setPaused(true, {
          from: App.account
        })
        .on('transactionHash', function (hash) {
          outSpinner();
          showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
        })
        .on('receipt', function (receipt) {
          if (!receipt.status) {
            $("#txStatusUp").empty();
            throw new Error("The transaction failed");
          }
          $("#txStatusUp").empty();
          $(".spinnerCube").empty();
          showSuccess(txStatusUp, "You just paused the operator contract", 1000);
          App.updateBalanceSender();
        })
        .on('error', function (err) {
          $("#txStatusUp").empty();
          showAlert(txStatusUp, err, 100);
        });
    }
    await App.checkActivity();
  },

  bindEvents: function () {
    $(document).on('click', '#setVehicleType', App.setVehicleType);
    $(document).on('click', '#createNewOperator', App.createNewOperator);
    $(document).on('click', '#addTollBooth', App.addTollBooth);
    $(document).on('click', '#setRoutePrice', App.setRoutePrice);
    $(document).on('click', '#setMultiplier', App.setMultiplier);
    $(document).on('click', '#hashSecret', App.hashSecret);
    $(document).on('click', '#enterRoad', App.enterRoad);
    $(document).on('click', '#reportExitRoad', App.reportExitRoad);
    $(document).on('click', '#updateExitHistory', App.updateExitHistory);
    $(document).on('click', '#activity', App.pauseResume);
  },
  
  // Contract functions

  setVehicleType: async function () {
    $(".spinnerCube").empty();
    $("#txStatusUp").empty();
    cubeSpinner('#txStatusUp');
    const vehicleAddress = $('#vehicleAddress').val();
    const vehicleType = $('#vehicleType').val();
    const regulator = await App.Regulator.deployed();
    const success = await regulator.setVehicleType.call(vehicleAddress, vehicleType, {
      from: App.account
    })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await regulator.setVehicleType(vehicleAddress, vehicleType, {
        from: App.account
      })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "You just set the type: " + vehicleType + ". For the vehicle address: " + vehicleAddress, 1000);
        App.updateBalanceSender();
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });
  },

  createNewOperator: async function () {
    $(".spinnerCube").empty();
    $("#txStatusUp").empty();
    cubeSpinner('#txStatusUp');
    const operatorAddress = $('#operatorAddress').val();
    const operatorDeposit = $('#operatorDeposit').val();
    const regulator = await App.Regulator.deployed();
    const success = await regulator.createNewOperator.call(operatorAddress, operatorDeposit, {
      from: App.account,
      gas: 3100000
    })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await regulator.createNewOperator(operatorAddress, operatorDeposit, {
        from: App.account,
        gas: 3100000
      })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "You just created a new Toll Booth Regulator. The address is: " + receipt.logs[0].address + ", the deposit is: " + operatorDeposit + " WEI's, and the owner address is: " + operatorAddress, 1000);
        // App.updateBalanceContract();
        App.updateBalanceSender();
        // App.updateBalanceFees();
        App.getOperatorsForLogs();
        // App.getOperatorsForVehicles();
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });
  },

  addTollBooth: async function () {
    $(".spinnerCube").empty();
    $("#txStatusUp").empty();
    cubeSpinner('#txStatusUp');
    let tollBoothAddress = $("#tollBoothAddress").val();
    const success = await App.TBO.addTollBooth.call(tollBoothAddress, {
      from: App.account
    })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await App.TBO.addTollBooth(tollBoothAddress, {
        from: App.account
      })      
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "You just created the Toll Booth: " + tollBoothAddress, 1000);
        App.updateBalanceSender();
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });      
  },

  setRoutePrice: async function () {
    $(".spinnerCube").empty();
    $("#txStatusUp").empty();
    cubeSpinner('#txStatusUp');
    let tollBoothEntryAddress = $("#tollBoothEntryAddress").val();
    let tollBoothExitAddress = $("#tollBoothExitAddress").val();
    let routePrice = $("#routePrice").val();
    const success = await App.TBO.setRoutePrice.call(tollBoothEntryAddress,
      tollBoothExitAddress,
      routePrice, {
        from: App.account
      })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await App.TBO.setRoutePrice(tollBoothEntryAddress,
        tollBoothExitAddress,
        routePrice, {
          from: App.account
        })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "You just set the Route between the Toll Booth Entry: " + tollBoothEntryAddress + ". And the Toll Booth Exit: " + tollBoothExitAddress + ". With a price of: " + routePrice + " WEI's.", 1000);
        App.updateBalanceSender();
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });
  },

  setMultiplier: async function () {
    $(".spinnerCube").empty();
    $("#txStatusUp").empty();
    cubeSpinner('#txStatusUp');
    let vehicleTypeMultiplier = $("#vehicleTypeMultiplier").val();
    let multiplier = $("#multiplier").val();
    const success = await App.TBO.setMultiplier.call(vehicleTypeMultiplier,
      multiplier, {
        from: App.account
      })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await App.TBO.setMultiplier(vehicleTypeMultiplier,
        multiplier, {
          from: App.account
        })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "You just set the multiplier for the vehicle type number: " + vehicleTypeMultiplier + ". And the multiplier factor is: " + multiplier + ".", 1000);
        App.updateBalanceSender();
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });
  },

  hashSecret: async function () {
    $("#txStatusUp").empty();
    if ($("#secret").val() == "") {
      showAlert(txStatusUp, "Please fill the secret field", 100);
      return false;
    }
    cubeSpinner('#txStatusUp');
    const secret = App.bytes32($('#secret').val());
    const hash = await App.TBOforVehicles.hashSecret(secret, {
      from: App.account
    });
    $("#txStatusUp").empty();
    showSuccess(txStatusUp, 'Created Hash: ' + hash, 1000);
  },

  enterRoad: async function () {
    $(".spinnerCube").empty();
    $("#txStatusUp").empty();
    cubeSpinner('#txStatusUp');
    let enterRoadAddress = $("#enterRoadAddress").val();
    let enterRoadHash = $("#enterRoadHash").val();
    let enterDeposit = $("#enterDeposit").val();
    const success = await App.TBOforVehicles.enterRoad.call(enterRoadAddress,
      enterRoadHash, {
        from: App.account,
        value: enterDeposit
      })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await App.TBOforVehicles.enterRoad(enterRoadAddress,
        enterRoadHash, {
          from: App.account,
          value: enterDeposit
        })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "The vehicle has entered the road, the Entry Toll Booth is: " + enterRoadAddress + ". The secret hash is: " + enterRoadHash + " and the deposit is: " + enterDeposit + " WEI's.", 1000);
        App.updateBalanceSender();
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });
  },

  reportExitRoad: async function () {
    $(".spinnerCube").empty();
    $("#txStatusUp").empty();
    cubeSpinner('#txStatusUp');
    let reportExitRoadSecret = App.bytes32($("#reportExitRoadSecret").val());
    const success = await App.TBOforTollBooths.reportExitRoad.call(reportExitRoadSecret, {
      from: App.account
    })
    if (!(success == 1 || success == 2)) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await App.TBOforTollBooths.reportExitRoad(reportExitRoadSecret, {
        from: App.account
      })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      })
      .then(txObj => {
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        if (success == 1) {
          let result = txObj.logs[0].args;
          showSuccess(txStatusUp, "The vehicle exit the road. The exit secret hashed is: " + result.exitSecretHashed + ". The exit booth is: " + result.exitBooth + ". The final fee is: " + result.finalFee + " WEI's. And the refund amount is: " + result.refundWeis + " WEI's.", 1000);
        }
        if (success == 2) {
          let result = txObj.logs[0].args;
          showSuccess(txStatusUp, "The vehicle exit the road, but he got a PENDING PAYMENT. The exit secret hashed is: " + result.exitSecretHashed + ". The entry booth is: " + result.entryBooth + " and the exit booth is: " + result.exitBooth + ".", 1000);
        }
        App.updateBalanceSender();
      })
      .catch(e => {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, e, 100);
        console.error(e);
      });
  },

  // History (Entry - Exit) functions

  updateEntryHistory: async function () {
    App.entries = [];
    $("#LogRoadEntered").empty();
    var cont = 1;
    $("#LogRoadEntered").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogRoadEntered" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Vehicle</th>
          <th class="text-center">Entry Booth</th>
          <th class="text-center">Exit Secret Hashed</th>
          <th class="text-center">Multiplier</th>
          <th class="text-center">Deposit</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    const event = await App.TBOforVehicles.getPastEvents("LogRoadEntered", {
      filter: {
        vehicle: App.account
      },
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < event.length; i++) {
      var datosEvento = event[i].args;
      var vehicle = datosEvento.vehicle;
      var entryBooth = datosEvento.entryBooth;
      var exitSecretHashed = datosEvento.exitSecretHashed;
      App.entries.push(exitSecretHashed);
      var multiplier = datosEvento.multiplier;
      var depositWEI = datosEvento.depositedWeis;
      var depositETH = App.web3.utils.fromWei(depositWEI, "ether") + " ETH";
      $("#tableLogRoadEntered tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${vehicle}</td>
          <td class="p-1 text-center tdLogs">${entryBooth}</td>
          <td class="p-1 text-center tdLogs">${exitSecretHashed}</td>
          <td class="p-1 text-center" style="width: 5px">${multiplier}</td>
          <td class="p-1 text-center tdLogs" title="${depositETH}">${depositWEI} WEI's</td>
        </tr>               
      `);
      cont++;
    }
  },

  updateExitHistory: async function () {
    $("#LogRoadExited").empty();
    var cont = 1;
    $("#LogRoadExited").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogRoadExited" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Exit Booth</th>
          <th class="text-center">Exit Secret Hashed</th>
          <th class="text-center">Final Fee</th>
          <th class="text-center">Refund</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    
      if (App.entries.length == 0){
        return false;
        }
      else {
        for(let i = 0; i < App.entries.length; i++) {
          const event = await App.TBOforVehicles.getPastEvents("LogRoadExited", {
          filter: {
            exitSecretHashed: App.entries[i]
          },
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < event.length; i++) {
      var datosEvento = event[i].args;
            var exitBooth = datosEvento.exitBooth;
            var exitSecretHashed = datosEvento.exitSecretHashed;
            var finalFee = datosEvento.finalFee;
            var finalFeeETH = App.web3.utils.fromWei(finalFee, "ether") + " ETH";
            var refundWeis = datosEvento.refundWeis;
            var refundWeisETH = App.web3.utils.fromWei(refundWeis, "ether") + " ETH";
            $("#tableLogRoadExited tbody").after(`           
              <tr class="table table-light table-hover table-striped table-bordered rounded">
                <td class="p-1 text-center tdLogs">${cont}</td>
                <td class="p-1 text-center tdLogs">${exitBooth}</td>
                <td class="p-1 text-center tdLogs">${exitSecretHashed}</td>
                <td class="p-1 text-center tdLogs" title="${finalFeeETH}">${finalFee} WEI's</td>
                <td class="p-1 text-center tdLogs" title="${refundWeisETH}">${refundWeis} WEI's</td>
              </tr>               
            `);
            cont++;
          }
        }
      }
  },

  // Logs

  LogVehicleTypeSet: async function () {
    $("#txStatusUp").empty();
    $("#LogVehicleTypeSet").empty();
    var cont = 1;
    $("#LogVehicleTypeSet").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogVehicleTypeSet" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Sender</th>
          <th class="text-center">Vehicle</th>
          <th class="text-center">Type</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    let regulator = await App.Regulator.deployed();
    const event = await regulator.getPastEvents("LogVehicleTypeSet", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < event.length; i++) {
      var datosEvento = event[i].args;
      var sender = datosEvento.sender;
      var vehicle = datosEvento.vehicle;
      var vehicleType = datosEvento.vehicleType;
      $("#tableLogVehicleTypeSet tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${sender}</td>
          <td class="p-1 text-center tdLogs">${vehicle}</td>
          <td class="p-1 text-center tdLogs">${vehicleType}</td>
        </tr>               
      `);
      cont++;
    }
  },

  LogTollBoothOperatorCreated: async function () {
    $("#txStatusUp").empty();
    $("#LogTollBoothOperatorCreated").empty();
    var cont = 1;
    $("#LogTollBoothOperatorCreated").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogTollBoothOperatorCreated" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Sender</th>
          <th class="text-center">New Operator</th>
          <th class="text-center">Owner</th>
          <th class="text-center">Deposit</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    let regulator = await App.Regulator.deployed();
    const event = await regulator.getPastEvents("LogTollBoothOperatorCreated", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < event.length; i++) {
      var datosEvento = event[i].args;
      var sender = datosEvento.sender;
      var newOperator = datosEvento.newOperator;
      var owner = datosEvento.owner;
      var depositWEI = datosEvento.depositWeis;
      var depositETH = App.web3.utils.fromWei(depositWEI, "ether") + " ETH";
      $("#tableLogTollBoothOperatorCreated tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${sender}</td>
          <td class="p-1 text-center tdLogs">${newOperator}</td>
          <td class="p-1 text-center tdLogs">${owner}</td>
          <td class="p-1 text-center tdLogs" title="${depositETH}">${depositWEI} WEI's</td>
        </tr>               
      `);
      cont++;
    }
  },

  LogTollBoothAdded: async function () {
    $("#txStatusUp").empty();
    $("#LogTollBoothAdded").empty();
    var cont = 1;
    $("#LogTollBoothAdded").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogTollBoothAdded" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Sender</th>
          <th class="text-center">Toll Booth</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    const event = await App.TBOforLogs.getPastEvents("LogTollBoothAdded", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < event.length; i++) {
      var datosEvento = event[i].args;
      var sender = datosEvento.sender;
      var tollBooth = datosEvento.tollBooth;
      $("#tableLogTollBoothAdded tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${sender}</td>
          <td class="p-1 text-center tdLogs">${tollBooth}</td>
        </tr>               
      `);
      cont++;
    }
  },

  LogRoutePriceSet: async function () {
    $("#txStatusUp").empty();
    $("#LogRoutePriceSet").empty();
    var cont = 1;
    $("#LogRoutePriceSet").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogRoutePriceSet" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Sender</th>
          <th class="text-center">Entry Booth</th>
          <th class="text-center">Exit Booth</th>
          <th class="text-center">Price</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    const event = await App.TBOforLogs.getPastEvents("LogRoutePriceSet", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < event.length; i++) {
      var datosEvento = event[i].args;
      var sender = datosEvento.sender;
      var entryBooth = datosEvento.entryBooth;
      var exitBooth = datosEvento.exitBooth;
      var depositWEI = datosEvento.priceWeis;
      var depositETH = App.web3.utils.fromWei(depositWEI, "ether") + " ETH";
      $("#tableLogRoutePriceSet tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${sender}</td>
          <td class="p-1 text-center tdLogs">${entryBooth}</td>
          <td class="p-1 text-center tdLogs">${exitBooth}</td>
          <td class="p-1 text-center tdLogs" title="${depositETH}">${depositWEI} WEI's</td>
        </tr>               
      `);
      cont++;
    }
  },

  LogMultiplierSet: async function () {
    $("#txStatusUp").empty();
    $("#LogMultiplierSet").empty();
    var cont = 1;
    $("#LogMultiplierSet").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogMultiplierSet" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Sender</th>
          <th class="text-center" title="Vehicle Type">Type</th>
          <th class="text-center">Multiplier</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    const event = await App.TBOforLogs.getPastEvents("LogMultiplierSet", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < event.length; i++) {
      var datosEvento = event[i].args;
      var sender = datosEvento.sender;
      var vehicleType = datosEvento.vehicleType;
      var multiplier = datosEvento.multiplier;
      $("#tableLogMultiplierSet tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${sender}</td>
          <td class="p-1 text-center" style="width: 5px" title="Vehicle Type">${vehicleType}</td>
          <td class="p-1 text-center" style="width: 5px">${multiplier}</td>
        </tr>               
      `);
      cont++;
    }
  },

  LogRoadEntry: async function () {
    $("#txStatusUp").empty();
    $("#LogRoadEntry").empty();
    var cont = 1;
    $("#LogRoadEntry").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogRoadEntry" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Vehicle</th>
          <th class="text-center">Entry Booth</th>
          <th class="text-center">Exit Secret Hashed</th>
          <th class="text-center">Multiplier</th>
          <th class="text-center">Deposit</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    const event = await App.TBOforLogs.getPastEvents("LogRoadEntered", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < event.length; i++) {
      var datosEvento = event[i].args;
      var vehicle = datosEvento.vehicle;
      var entryBooth = datosEvento.entryBooth;
      var exitSecretHashed = datosEvento.exitSecretHashed;
      var multiplier = datosEvento.multiplier;
      var depositWEI = datosEvento.depositedWeis;
      var depositETH = App.web3.utils.fromWei(depositWEI, "ether") + " ETH";
      $("#tableLogRoadEntry tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${vehicle}</td>
          <td class="p-1 text-center tdLogs">${entryBooth}</td>
          <td class="p-1 text-center tdLogs">${exitSecretHashed}</td>
          <td class="p-1 text-center tdLogs">${multiplier}</td>
          <td class="p-1 text-center tdLogs" title="${depositETH}">${depositWEI} WEI's</td>
        </tr>               
      `);
      cont++;
    }
  },

  LogRoadExit: async function () {
    $("#txStatusUp").empty();
    $("#LogRoadExit").empty();
    var cont = 1;
    $("#LogRoadExit").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogRoadExit" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Exit Booth</th>
          <th class="text-center">Exit Secret Hashed</th>
          <th class="text-center">Final Fee</th>
          <th class="text-center">Refund</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    const event = await App.TBOforLogs.getPastEvents("LogRoadExited", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < event.length; i++) {
      var datosEvento = event[i].args;
      var exitBooth = datosEvento.exitBooth;
      var exitSecretHashed = datosEvento.exitSecretHashed;
      var feeWEI = datosEvento.finalFee;
      var feeETH = App.web3.utils.fromWei(feeWEI, "ether") + " ETH";
      var refundWEI = datosEvento.refundWeis;
      var refundETH = App.web3.utils.fromWei(refundWEI, "ether") + " ETH";
      $("#tableLogRoadExit tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${exitBooth}</td>
          <td class="p-1 text-center tdLogs">${exitSecretHashed}</td>
          <td class="p-1 text-center tdLogs" title="${feeETH}">${feeWEI} WEI's</td>
          <td class="p-1 text-center tdLogs" title="${refundETH}">${refundWEI} WEI's</td>
        </tr>               
      `);
      cont++;
    }
  },

  LogPendingPayment: async function () {
    $("#txStatusUp").empty();
    $("#LogPendingPayment").empty();
    var cont = 1;
    $("#LogPendingPayment").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogPendingPayment" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Exit Secret Hashed</th>
          <th class="text-center">Entry Booth</th>
          <th class="text-center">Exit Booth</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    const event = await App.TBOforLogs.getPastEvents("LogPendingPayment", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < event.length; i++) {
      var datosEvento = event[i].args;
      var exitSecretHashed = datosEvento.exitSecretHashed;
      var entryBooth = datosEvento.entryBooth;
      var exitBooth = datosEvento.exitBooth;
      $("#tableLogPendingPayment tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${exitSecretHashed}</td>
          <td class="p-1 text-center tdLogs">${entryBooth}</td>
          <td class="p-1 text-center tdLogs">${exitBooth}</td>
        </tr>               
      `);
      cont++;
    }
  },

  // Handlers

  getMinimumDeposit: async function () {
    $("#txStatusUp").empty();
    if (App.TBOforVehicles == null) {
      showAlert(txStatusUp, 'Please select a Toll Booth Operator Contract.', 100);
    } else {
      try {
        const regulator = await App.Regulator.deployed();
        const type = await regulator.getVehicleType.call(App.account, {
          from: App.account
        });
        const deposit = await App.TBOforVehicles.getDeposit.call();
        const multiplier = await App.TBOforVehicles.getMultiplier.call(type);
        const minDeposit = multiplier.mul(deposit);

        if (type.toString(10) == '0') {
          App.updateMinimumDeposit(type);
          showAlert(txStatusUp, "This account is not registered as a Vehicle (Type is 0, should be set the vehicle type)", 100);
          App.isVehicle = false;
        } else if (multiplier.toString(10) == '0') {
          showAlert(txStatusUp, "Vehicle is not authorized for this Tool Booth Operator Contract (Multiplier is 0, should be set the multiplier)", 100);
          App.updateMinimumDeposit(multiplier);
          App.isVehicle = false;
        } else {
          App.updateMinimumDeposit(minDeposit);
          showSuccess(txStatusUp, "The minimum deposit to you for this Tool Booth Operator is: " + minDeposit.toString(10) + " WEI's.", 1000);
          App.isVehicle = true;
        }
        App.vehicleActivity(App.isVehicle);
      } catch (error) {
        showAlert(txStatusUp, error, 100);
      }
    }
  },

  getOperators: async function () {
    document.getElementById('operators').disabled = false;
    $('#operators').empty();
    var count = 0;
    let regulator = await App.Regulator.deployed();
    const events = await regulator.getPastEvents("LogTollBoothOperatorCreated", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < events.length; i++) {
      if (App.account.toLowerCase() === events[i].args.owner.toLowerCase()) {
        $("#operators").append(`
        <option tabindex="${count}" value="${events[i].args.newOperator}">Operator ${count + 1} : ${events[i].args.newOperator}</option>
        `);
        count = count + 1;
      }
    }
    if (count == 0) {
      $("#operators").append(`
        <option selected value="0">You should be a Toll Booth Operator Owner</option>
        `);
      document.getElementById('operators').disabled = true;
      App.isOperator = false;
    } else {
      await App.changeOperator();
      App.isOperator = true;
    }
    await App.operatorActivity(App.isOperator);
  },

  getOperatorsForVehicles: async function () {
    document.getElementById('operatorsForVehicles').disabled = false;
    $('#operatorsForVehicles').empty();
    var count = 0;
    let regulator = await App.Regulator.deployed();
    const events = await regulator.getPastEvents("LogTollBoothOperatorCreated", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < events.length; i++) {
      $("#operatorsForVehicles").append(`
        <option tabindex="${count}" value="${events[i].args.newOperator}">Operator ${count + 1} : ${events[i].args.newOperator}</option>
        `);
      count = count + 1;
    }
    if (count == 0) {
      $("#operatorsForVehicles").append(`
        <option selected value="0">The Toll Booth Operators are empty</option>
        `);
      document.getElementById('operatorsForVehicles').disabled = true;
    } else {
      await App.changeOperatorForVehicles();
    }
  },

  getOperatorsForTollBooths: async function () {
    document.getElementById('operatorsForTollBooths').disabled = false;
    $('#operatorsForTollBooths').empty();
    var count = 0;
    let regulator = await App.Regulator.deployed();
    const events = await regulator.getPastEvents("LogTollBoothOperatorCreated", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < events.length; i++) {
      $("#operatorsForTollBooths").append(`
        <option tabindex="${count}" value="${events[i].args.newOperator}">Operator ${count + 1} : ${events[i].args.newOperator}</option>
        `);
      count = count + 1;
    }
    if (count == 0) {
      $("#operatorsForTollBooths").append(`
        <option selected value="0">The Toll Booth Operators are empty</option>
        `);
      document.getElementById('operatorsForTollBooths').disabled = true;
    } else {
      await App.changeOperatorForTollBooths();
    }
  },

  getOperatorsForLogs: async function () {
    document.getElementById('operatorsForLogs').disabled = false;
    $('#operatorsForLogs').empty();
    var count = 0;
    let regulator = await App.Regulator.deployed();
    const events = await regulator.getPastEvents("LogTollBoothOperatorCreated", {
      fromBlock: 0,
      toBlock: 'latest'
    });
    for (let i = 0; i < events.length; i++) {
      $("#operatorsForLogs").append(`
        <option tabindex="${count}" value="${events[i].args.newOperator}">${count + 1} : ${events[i].args.newOperator}</option>
        `);
      count = count + 1;
    }
    if (count == 0) {
      $("#operatorsForLogs").append(`
        <option selected value="0">The Toll Booth Operators are empty</option>
        `);
      document.getElementById('operatorsForLogs').disabled = true;
    } else {
        await App.changeOperatorForLogs();
        await App.updateLogs();
    }
  },

  getAccountsForTBO: async function () {
    document.getElementById('yourAddress').disabled = false;
    $('#yourAddress').empty();
    const accounts = await App.web3.eth.getAccounts();
    var count = 0;
    for (let i = 0; i < accounts.length; i++) {
      $("#yourAddress").append(`
        <option tabindex="${count}" value="${accounts[i]}">${i} : ${accounts[i]}</option>
        `);
      count = count + 1;
    }
    if (count == 0) {
      $("#yourAddress").append(`
        <option selected value="0">No account to use</option>
        `);
      document.getElementById('yourAddress').disabled = true;
    } else {
        await App.changeAccountForTBO();
    }
  },

  changeOperator: async function () {
    App.TBO = await App.TollBoothOperator.at($("#operators").val());
    await App.updateBalanceContract();
  },

  changeOperatorForVehicles: async function () {
    App.TBOforVehicles = await App.TollBoothOperator.at($("#operatorsForVehicles").val());
    await App.updateContractBalanceSender();
    await App.getMinimumDeposit();
    await App.updateEntryHistory();
    $("#tableLogRoadExited").empty();
  },

  changeOperatorForTollBooths: async function () {
    App.TBOforTollBooths = await App.TollBoothOperator.at($("#operatorsForTollBooths").val());
  },

  changeOperatorForLogs: async function () {
    App.TBOforLogs = await App.TollBoothOperator.at($("#operatorsForLogs").val());
  },

  changeAccountForTBO: async function () {
    App.account = $("#yourAddress").val();
    await App.updateBalanceSender();
  },

  updateBalanceSender: async function () {
    var result = await App.getBalance(App.account);
    document.getElementById("yourBalance").innerHTML = result + " WEI";
    document.getElementById("yourBalanceEth").innerHTML = App.weiToEth(result);
  },

  getBalance: async function (address) {
    const balance = promisify(cb => App.web3.eth.getBalance(address, cb))
    try {
      return balance
    } catch (error) {
      showAlert(txStatusUp, 'Transaction rejected: ' + error);
    }
  },

  updateContractBalanceSender: async function () {
    var result = await App.getCBalance(App.account);
    document.getElementById("yourCBalance").innerHTML = result + " WEI";
    document.getElementById("yourCBalanceEth").innerHTML = App.weiToEth(result);
  },

  getCBalance: async function () {
    const balance = await App.TBOforVehicles.getPayment(App.account);
    return balance;
  },

  updateMinimumDeposit: async function (minDeposit) {
    document.getElementById("minDeposit").innerHTML = minDeposit + " WEI";
    document.getElementById("minDepositEth").innerHTML = App.weiToEth(minDeposit);
  },

  //Helpers

  weiToEth: function (amount) {
    return App.web3.utils.fromWei(amount, "ether") + " ETH";
  },

  bytes32: function (value) {
    return App.web3.utils.fromAscii(value);
  },

  regulatorActivity: async function(activity) {
    document.getElementById('operatorAddress').disabled = !activity;
    document.getElementById('operatorDeposit').disabled = !activity;
    document.getElementById('createNewOperator').disabled = !activity;
    document.getElementById('vehicleAddress').disabled = !activity;
    document.getElementById('vehicleType').disabled = !activity;
    document.getElementById('setVehicleType').disabled = !activity;
    if($("#nav-regulator-tab").hasClass("active")) {
      if(!activity) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, 'You should be the Regulator to make transactions in this section.', 100);
      }
    }
  },

  operatorActivity: async function(activity) {
    document.getElementById('tollBoothAddress').disabled = !activity;
    document.getElementById('addTollBooth').disabled = !activity;
    document.getElementById('tollBoothEntryAddress').disabled = !activity;
    document.getElementById('tollBoothExitAddress').disabled = !activity;
    document.getElementById('routePrice').disabled = !activity;
    document.getElementById('setRoutePrice').disabled = !activity;
    document.getElementById('vehicleTypeMultiplier').disabled = !activity;
    document.getElementById('multiplier').disabled = !activity;
    document.getElementById('setMultiplier').disabled = !activity;
    if($("#nav-tollBoothOperator-tab").hasClass("active")) {
      if(!activity) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, 'You should be an Owner Operator to make transactions in this section.', 100);
      }
    }
  },

  vehicleActivity: async function(activity) {
    document.getElementById('secret').disabled = !activity;
    document.getElementById('hashSecret').disabled = !activity;
    document.getElementById('enterRoadAddress').disabled = !activity;
    document.getElementById('enterRoadHash').disabled = !activity;
    document.getElementById('enterDeposit').disabled = !activity;
    document.getElementById('enterRoad').disabled = !activity;
  },

  tollBoothActivity: async function(activity) {
    document.getElementById('reportExitRoadSecret').disabled = !activity;
    document.getElementById('reportExitRoad').disabled = !activity;
    if($("#nav-tollBooth-tab").hasClass("active")) {
      if(!activity) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, 'You should be a Toll Booth of this Toll Booth Operator Contract to make transactions in this section.', 100);
      }
    }
    
  },

  cleanSubscriptions: async function() {
    if (App.subscriptions.length > 0) {
      for(let i = 0; i < App.subscriptions.length; i++)
      {
        await App.subscriptions[i].unsubscribe();    
      }
      App.subscriptions = [];
    }
  },

  updateLogs: async function() {
    await App.LogTollBoothAdded();
    await App.LogRoutePriceSet();
    await App.LogMultiplierSet();
    await App.LogRoadEntry();
    await App.LogRoadExit();
    await App.LogPendingPayment();
  },

};

//Event Listeners

$("#operators").change(async function () {
  await App.changeOperator();
});

$("#operatorsForVehicles").change(async function () {
  await App.changeOperatorForVehicles();
});

$("#operatorsForTollBooths").change(async function () {
  $("#txStatusUp").empty();
  await App.changeOperatorForTollBooths();
  await App.checkTollBooth();
});

$("#operatorsForLogs").change(async function () {
  await App.cleanSubscriptions();
  await App.changeOperatorForLogs();
  await App.updateLogs();
});

$("#yourAddress").change(async function () {
  await App.changeAccountForTBO();
  await App.checkRegulator();
  await App.getOperators();
  
  if ($("#nav-vehicle-tab").hasClass("active")) {
    await App.getOperatorsForVehicles();
  }
  if ($("#nav-tollBooth-tab").hasClass("active")) {
    await App.getOperatorsForTollBooths();
    await App.checkTollBooth();
  }
});

$("#nav-regulator-tab").on("click", async function () {
  $("#txStatusUp").empty();
  await App.checkRegulator();
});

$("#nav-tollBoothOperator-tab").on("click", async function () {
  $("#txStatusUp").empty();
  await App.getOperators();
});

$("#nav-vehicle-tab").on("click", async function () {
  $("#txStatusUp").empty();
  await App.getOperatorsForVehicles();
});

$("#nav-tollBooth-tab").on("click", async function () {
  $("#txStatusUp").empty();
  await App.getOperatorsForTollBooths();
  await App.checkTollBooth();
});

$(function () {
  $(window).on('load', function () {
    App.initWeb3();
  });
});