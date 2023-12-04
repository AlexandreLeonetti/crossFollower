// robot
// when it works, just host on heroku or aws
require('dotenv').config();

const crypto = require("crypto");
const cron = require("node-cron");
const robot = require("./robot");
const express = require("express");
const fs    =   require("fs");

const _apiKey    = process.env.BINANCE_API_KEY;
const _apiSecret = process.env.BINANCE_SECRET;

const app = express();
const formatter = robot.formatter;

app.listen(6000, () => console.log("app listening on 5000"));

app.get("/", (req,res) => res.json("API is running"));

function logCurrentDay() {
	      const currentDate = new Date();
	      const formattedDate = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
	      return formattedDate;
}


async function strat(stopLoss, limitLoss, logStream) {
    	//console.log(1 - stopLoss, 1 - limitLoss);
    const currentDate = new Date();
    let logMsg = `\n\n ${currentDate} \n`;
    logStream.write(logMsg);
    
    
	const symbol = "BTCFDUSD";

    let fdusd = 0;
    let bitcoin= 0;
	let balance = await robot.getAccountBalance(_apiKey, _apiSecret, logStream); //
    if(balance.error === true ){
        logStream.write(JSON.stringify(balance, null, 2));
       
	    balance = await robot.getAccountBalance(_apiKey, _apiSecret, logStream); //
        if(balance.error === true ){
            logStream.write(JSON.stringify(balance, null, 2)+`\n`);
	    logStream.write(`now function strat will return 0. \n`); 
	    return 0;
        }else{
	        fdusd = formatter(balance.fdusd, 1, 2);
	        bitcoin = formatter(balance.bitcoin, 1, 5);
            logStream.write(`on second trial`);
	        logStream.write(`fdusd =${fdusd} , bitcoin = ${bitcoin} ; \n`);
        }
    }else{
	    fdusd = formatter(balance.fdusd, 1, 2);
	    bitcoin = formatter(balance.bitcoin, 1, 5);
	    logStream.write(`fdusd =${fdusd} , bitcoin = ${bitcoin} ; \n`);
    }

	const price = await robot.getTickerPrice(symbol);

	if (fdusd > 35) {
		// WE HAVE FDUSD - position OUT
		/* must add the condition to buy only if ticker is above ma */
        logStream.write(`balance is ${fdusd} fdusd, position is OUT.\n`);
		const maConditions = await robot.isAboveMa(price);
		if (maConditions.isAbove) {
			logStream.write("price is above ma, placing order...\n");

			const tx = await robot.makeTrade(
				symbol,
				"BUY",
				fdusd,
				_apiKey,
				_apiSecret
			);
            logStream.write(JSON.stringify(tx, null, 2));
			bitcoin = formatter(tx.executedQty, 1, 5);

			let avgPrice = parseFloat(
				(tx.cummulativeQuoteQty / tx.executedQty).toFixed(2)
			);
			let stopPrice = formatter(avgPrice, 1 - stopLoss, 2);
			let limit = formatter(avgPrice, 1 - limitLoss, 2);

			const stopLossTx = await robot.makeStopLossSell(
				symbol,
				"SELL",
				bitcoin,
				stopPrice,
				limit,
				_apiKey,
				_apiSecret
			);
            logStream.write(`placed stop loss\n`);
            logStream.write(JSON.stringify(stopLossTx, null, 2));
		} else {
			logStream.write(`price is under ma, not buying.\n`);
		}
	} else {
		// WE DONT HAVE FDUSD - Position IN

		/* got ticker price, also need MA price */

		const cancelOrds = await robot.cancelOrders(
			symbol,
			_apiKey,
			_apiSecret
		);

		/* ==>>>> this returns price of previous stop loss */
        logStream.write("cancelling SL\n");
        logStream.write(JSON.stringify(cancelOrds, null, 2)+`\n`);

		if (Object.hasOwn(cancelOrds, "code")) {
			// if there are no stops to cancel
			//this should ideally never be called.
			//this is basically exiting position.
			//perhaps consider selling immediately here.
			logStream.write("this stop loss should never be called \n");
			let stopPrice = formatter(price, 1 - stopLoss, 2);
			let limit = formatter(price, 1 - limitLoss, 2);

			const stopLossTx = await robot.makeStopLossSell(
				symbol,
				"SELL",
				bitcoin,
				stopPrice,
				limit,
				_apiKey,
				_apiSecret
			);
         logStream.write(JSON.stringify(stopLossTx, null, 2)+`\n`);
           
		} else {
			// there are stops to cancel
			/* if sl is above ma, dont touch it.
			 * else move it at ma level
			 */
            logStream.write("cancelOrds\n");

			logStream.write(JSON.stringify(cancelOrds[0].stopPrice, null,2)+`\n`);
            
            const prevStop = formatter(cancelOrds[0].stopPrice,1,2);
			const stop = await robot.isAboveMa(prevStop);
			if (stop.isAbove) {
                /* yes but it has been canceled so at least needs to be put back */

				let stopPrice = formatter(prevStop, 1, 2);
				let limit = formatter(prevStop, 1 - limitLoss, 2);
 
               	let cancelledQty= cancelOrds[0].origQty;
				bitcoin = formatter(cancelledQty, 1, 5);

                /* problem here qty is invalid ? */
                /* to trigger this part i can pass higher stop loss on binance */
				const stopLossTx = await robot.makeStopLossSell(
					symbol,
					"SELL",
					bitcoin,
					stopPrice,
					limit,
					_apiKey,
					_apiSecret
				);
                logStream.write(`we are placing back the same stop because stop above ma\n`); 
                
                logStream.write(JSON.stringify(stopLossTx), null, 2);

				logStream.write("\n stop is above and ma is below, do nothing\n");
			} else {
				//raise stop to ma price

                logStream.write(`raising stop at MA level.\n`);
				origCurrency = cancelOrds[0].origQty;
				bitcoin = formatter(origCurrency, 1, 5);

				let stopPrice = formatter(stop.maPrice, 1, 2);
				let limit = formatter(stop.maPrice, 1 - limitLoss, 2);

				const stopLossTx = await robot.makeStopLossSell(
					symbol,
					"SELL",
					bitcoin,
					stopPrice,
					limit,
					_apiKey,
					_apiSecret
				);
                logStream.write(`prevStop = ${prevStop}, ma = ${stop.maPrice}, newStop = ${stopPrice} \n`);
                logStream.write(JSON.stringify(stopLossTx, null, 2)+ `\n`);
                
			}
		}
	}
	setTimeout(()=>{
		//console.log("closing srteam ...");
		logStream.end();
		logStream.destroy();
	}, 9000);
}
cronExpression = "58 14,29,44,59 * * * *";
//cronExpression = "0 */5 * * * *";
cron.schedule(cronExpression , () => {
	const day = logCurrentDay();
	
	/* create a log stream */
    	const logStream = fs.createWriteStream(`./logs/${day}.log`, {flags:'a'});


    	strat(0.00025,0.0004,logStream);
});



