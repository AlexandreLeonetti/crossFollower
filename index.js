require('dotenv').config();

const express = require("express");
const fs    =   require("fs");
const crypto = require("crypto");
const cron = require("node-cron");

const robot = require("./robot");
const cross = require("./cross");

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

async function buy(borrowed, symbol, bitcoin, _apiKey, _apiSecret, logStream){
    let tx = "";
    if( borrowed > 50){ 
        tx = await cross.crossBuyNormal( symbol, bitcoin, _apiKey, _apiSecret)
	    logStream.write(`Borrowed ${borrowed}, above 50, so crossBuyNormal. \n`); 
        logStream.write(JSON.stringify(tx, null, 2)+`\n`);
    }else{
        tx = await cross.crossBuy( symbol, bitcoin, _apiKey, _apiSecret)
	    logStream.write(`Borrowed ${borrowed}, below 50, so crossBuy and Borrow. \n`); 
        logStream.write(JSON.stringify(tx, null, 2)+`\n`);
    }
    return tx;
}

async function TEST_BALANCE(_apiKey, _apiSecret, logStream){
    let fdusd = 0;
    let bitcoin= 0;
    let bor     = 0;
    let balance = await cross.getCrossUsdDebt("FDUSD", _apiKey, _apiSecret);
    logStream.write(`\n balance \n`);
    logStream.write(JSON.stringify(balance, null, 2));


    if(balance.error === true ){
        logStream.write((JSON.stringify(balance, null, 2))+`\n`);
       
	    balance = await cross.getCrossUsdDebt("FDUSD", _apiKey, _apiSecret);
        if(balance.error === true ){
        logStream.write(JSON.stringify(balance, null, 2)+`\n`);
	    logStream.write(`now function strat will return 0. \n`); 
	    return 0;
        }else{//<<<<<<< use values accordingly
            //have to mess with bitcoin quantity as well<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< 
	        fdusd = formatter(balance.free, 1, 2);
            bor     = formatter(balance.borrowed, 1, 2);
	        bitcoin = formatter(balance.btcFree, 1, 5);
            logStream.write(` \n on second trial`);
	        logStream.write(`\n fdusd =${fdusd} , bitcoin = ${bitcoin} ; \n`);
            return { fdusd : fdusd, bor:bor, bitcoin : bitcoin};
        }
    }else{
	    fdusd   = formatter(balance.free, 1, 2);
        bor     = formatter(balance.borrowed, 1, 2);
	    bitcoin = formatter(balance.btcFree, 1, 5);
	    logStream.write(`\n fdusd =${fdusd} , bitcoin = ${bitcoin} ; \n`);
        return { fdusd : fdusd, bor:bor, bitcoin : bitcoin};
    }
}


async function ENTRY (stopLoss, limitLoss,  _apiKey, _apiSecret, logStream, fdusd, bor, bitcoin,symbol,price){

        logStream.write(`\n Available ${fdusd} fdusd,borrowed ${bor},  position is OUT.\n`);
		const maConditions = await robot.isAboveMa(price); //<<<<<<<<<<<<<
		if (maConditions.isAbove) {

			logStream.write("price is above ma, placing order...\n");
            logStream.write(`calculating ${fdusd+100-bor}*0.99/${price}...`);
            const str_bitcoin = ((fdusd+100-bor)*0.99/price).toString();
            const new_bitcoin = formatter(str_bitcoin,1,5); 
            const tx = await buy(bor, symbol, new_bitcoin, _apiKey, _apiSecret, logStream);
            /* account has insufficient balance for requested action */
            /*cross.crossBuy(symbol, bitcoin, _apiKey, _apiSecret);*/

            logStream.write(JSON.stringify(tx, null, 2));
			bitcoin = formatter(tx.executedQty, 1, 5);

			let avgPrice = parseFloat(
				(tx.cummulativeQuoteQty / tx.executedQty).toFixed(2)
			);

			let stopPrice = formatter(avgPrice, 1 - stopLoss, 2);
			let limit = formatter(avgPrice, 1 - limitLoss, 2);
            /* frequent error BTCFDUSD NaN NaN NaN */
            //console.log(symbol, bitcoin, stopPrice, limit);
            logStream.write(`symbol ${symbol}, bitcoin : ${bitcoin}, stopPrice : ${stopPrice}, limit : ${limit} \n`);
			const stopLossTx = await cross.stopSell(
				symbol,
				"SELL",
				bitcoin,
				stopPrice,
				limit,
				_apiKey,
				_apiSecret
			);
            logStream.write(`placed stop loss\n`);
            logStream.write((JSON.stringify(stopLossTx, null, 2))+`\n`);
		} else {
			logStream.write(`price is under ma, not buying.\n`);
		}

}

async function RAISE_STOP(stop, cancelOrds, logStream, _apiKey, _apiSecret){

                logStream.write(`raising stop at MA level.\n`);
				origCurrency = cancelOrds[0].origQty;
				bitcoin = formatter(origCurrency, 1, 5);

				let stopPrice = formatter(stop.maPrice, 1, 2);
				let limit = formatter(stop.maPrice, 1 - limitLoss, 2);

				const stopLossTx = await cross.stopSell(
					symbol,
					"SELL",
					bitcoin,
					stopPrice,
					limit,
					_apiKey,
					_apiSecret
				);
                logStream.write(`prevLimit = ${prevLimit}, ma = ${stop.maPrice}, newStop = ${stopPrice} \n`);
                logStream.write(JSON.stringify(stopLossTx, null, 2)+ `\n`);
}

async function  EMERGENCY_STOP(  symbol, price, stopLoss, limitLoss, bitcoin,
                _apiKey, _apiSecret, logStream  ){

			// if there are no stops to cancel
			// this should ideally never be called.
			// this is basically exiting position.
			// perhaps consider selling immediately here.

			logStream.write("this stop loss should never be called \n");
			let stopPrice = formatter(price, 1 - stopLoss, 2);
			let limit = formatter(price, 1 - limitLoss, 2);

			const stopLossTx = await cross.stopSell(
				symbol,
				"SELL",
				bitcoin,
				stopPrice,
				limit,
				_apiKey,
				_apiSecret
			);
         logStream.write(JSON.stringify(stopLossTx, null, 2)+`\n`);
            return stopLossTx;
           

}


async function  COPY_STOP (  symbol, price, stopLoss, limitLoss, bitcoin,
               cancelOrds,  _apiKey, _apiSecret, logStream ){
            const prevLimit = formatter(cancelOrds[0].price,1,2);

				let stopPrice = formatter(prevLimit,(1+ limitLoss  - stopLoss ) , 2);
				let limit = formatter(prevLimit, 1 , 2);
 
               	let cancelledQty= cancelOrds[0].origQty;
				bitcoin = formatter(cancelledQty, 1, 5);

				const stopLossTx = await cross.stopSell(
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
}

async function COMPARE_STOP(cancelOrds, logStream){
			// there are stops to cancel
            /* there is no ".stopPrice" returned from cancelOrds[0], only 
             * the limit price, we must check if making stopPrice == 1.002* limit price is ok
             * in a recursive setup
             */
            logStream.write("cancelOrds\n");
            
			logStream.write(JSON.stringify(cancelOrds[0], null,2)+`\n`);
			logStream.write(JSON.stringify(cancelOrds[0].price, null,2)+`\n`);
            
            const prevLimit = formatter(cancelOrds[0].price,1,2);
			const stop = await robot.isAboveSlowMa(prevLimit); // <<<<<<<<<<<<<

            return stop;


}
async function CANCEL(symbol, _apiKey, _apiSecret, logStream){
        // WE DONT HAVE FDUSD - Position IN == TRAIL STOP

        const cancelOrds =  await cross.cancelCrossOrders(symbol, _apiKey, _apiSecret);

        logStream.write("cancelling SL\n");
        logStream.write(JSON.stringify(cancelOrds, null, 2)+`\n`);
        return cancelOrds;
}
async function strat(stopLoss, limitLoss, logStream) {

	const symbol        = "BTCFDUSD";
    const currentDate   = new Date();
    const logMsg        = `\n\n ***** ${currentDate} *****  \n`;

    logStream.write(logMsg);
    let { fdusd, bor, bitcoin } = await TEST_BALANCE( _apiKey, _apiSecret, logStream );

	const price                 = await robot.getTickerPrice(symbol); 
    
    if(fdusd > 35){ 
        const entry      = await ENTRY( stopLoss, limitLoss, _apiKey, _apiSecret, logStream, fdusd, bor, bitcoin, symbol, price);
	}else{ 
        const cancelOrds = await CANCEL(symbol, _apiKey, _apiSecret, logStream);

		if (Object.hasOwn(cancelOrds, "code")) {
            const emergencyStop     = await EMERGENCY_STOP( symbol, price, stopLoss, limitLoss, bitcoin, _apiKey, _apiSecret, logStream );
		} else {
            const stop              = await COMPARE_STOP(cancelOrds, logStream);
			if (stop.isAbove) {
                const copyStop      = await COPY_STOP( symbol, price, stopLoss, limitLoss, bitcoin, cancelOrds,  _apiKey, _apiSecret, logStream);
			} else {
                const  raising      = await RAISE_STOP(stop, cancelOrds, logStream, _apiKey, _apiSecret);
			}
		}
	}

	setTimeout(()=>{
		logStream.end();
		logStream.destroy();
	}, 9000);

}


cronExpression = "58 14,29,44,59 * * * *";
//cronExpression = "0 */5 * * * *";

cron.schedule(cronExpression , () => {
	const day = logCurrentDay();
    const logStream = fs.createWriteStream(`./logs/${day}.log`, {flags:'a'});
    strat(0.0004,0.0006,logStream);
    /* slow ma is 100, consider moving it to 400 tmr */
    /* consider filtering useless buy orders under 0.0003 btc */
    /* consider incresing sell limit loss as we increase volume */
});



