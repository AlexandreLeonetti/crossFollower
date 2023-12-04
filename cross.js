// this is the module containing basic functions.
const crypto = require("crypto");



function formatter(s, factor, precision){
        n = factor*parseFloat(s);
        p = Math.pow(10, precision)
        n = Math.trunc(n*p)/p;
        n = parseFloat(n.toFixed(precision));
        return n
}



async function  getTickerPrice(symbol){
        try{
        const priceFetch = await fetch(`http://binance.com/api/v3/ticker/price?symbol=${symbol}`)
        const priceBody  = await priceFetch.json();
        return parseFloat(priceBody.price);

        }catch(error){
                            console.error("Error",error);
                            throw error;
        }

}

async function cancelCrossOrders(symbol, apiKey, apiSecret){
        try{
                    const timestamp = Date.now();
                    const endpoint  = "https://api.binance.com/sapi/v1/margin/openOrders";
                    const params    = {
                        symbol,
                        isIsolated : "FALSE",
                        timestamp
                    };

                    let queryString = Object.keys(params).map(key=> `${key}=${encodeURIComponent(params[key])}`).join("&");

                    const signature = crypto.createHmac("sha256", apiSecret)
                    .update(queryString)
                    .digest("hex");

                    queryString+="&signature="+signature;

                    const url = endpoint + "?" + queryString;
                    const request = await fetch(url, {
                                    method:"DELETE",
                                    headers:{
                                                        "X-MBX-APIKEY": apiKey,
                                                        "Content-Type": "application/x-www-form-urlencoded"
                                                    }
                                })


                    const response = await request.json();
                    console.log(response);
                    return response;

                }catch(error){
                            console.log("error", error);
                            throw error ;
                        }
}
/* create a stopSell */
async function stopBuy (symbol,  action, quantity, stopPrice, price, apiKey, apiSecret){
        try{
                    const endpoint = "https://api.binance.com/sapi/v1/margin/order";
                    const timestamp= Date.now();
                    const params ={
                                    symbol,
                                    isIsolated: "FALSE",
                                    side : "BUY", //SELL
                                    type : "STOP_LOSS_LIMIT",
                                    quantity,
                                    stopPrice,
                                    price,
                                    timeInForce : "GTC",
                                    timestamp
                                };
                    console.log(params);

                    let queryString = Object.keys(params).map(key=> `${key}=${encodeURIComponent(params[key])}`).join("&");

                    const signature = crypto.createHmac("sha256", apiSecret)
                    .update(queryString)
                    .digest("hex");

                    queryString+="&signature="+signature;

                    const url = endpoint + "?" + queryString;
                    const request = await  fetch(url, {
                                    method:"POST",
                                    headers:{
                                                        "X-MBX-APIKEY": apiKey,
                                                        "Content-Type": "application/x-www-form-urlencoded"
                                                    }
                                })

                    const response = await request.json();
                    console.log("response from stop loss order");
                    console.log(response);
                    return response;
                }catch(error){
                            console.log("Error", error)
                            throw error;
                }
}

async function getCrossDebt(symbol, apiKey, apiSecret){
    try{
        const timestamp = Date.now();
        const endpoint  = "https://api.binance.com/sapi/v1/margin/account";
        const params = {
                            timestamp : timestamp
                        };
        let queryString = Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key])}`).join("&");
        
        const signature =  crypto.createHmac("sha256", apiSecret)
        .update(queryString)
        .digest("hex");

        queryString+="&signature="+signature;
        
        const url = endpoint + "?" + queryString;

        const request = await fetch(url, {
                            method:"GET",
                            headers:{
                                "X-MBX-APIKEY" : apiKey,
                                "Content-Type" : "application/x-www-form-urlencoded"
                            }
        });

        const response = await request.json();
        const respArr= response.userAssets;
        const btcInfo = respArr.find((e) => e.asset === "BTC");
        const btcBorrowed = formatter(btcInfo.borrowed, 1, 5);
        console.log(btcBorrowed, typeof btcBorrowed);
        
        //userAssets is a large array.
        //element.asset === "BTC"
        //return response.assets[0].baseAsset.borrowed;
        return btcBorrowed; 
    }catch(err){
        console.log(err);
    }
}
/* crossBuy */
async function sellShortCross(symbol, quantity, apiKey, apiSecret){
    try{
         const timestamp= Date.now();
       const endpoint = "https://api.binance.com/sapi/v1/margin/order";
             const params ={
                                    symbol,
                                    isIsolated : "FALSE",
                                    side : "SELL",
                                    type : "MARKET",/*MARKET*/
                                    /*quoteOrderQty,*/
                                    quantity: 0.0005,
                                    /*price : 40000,*/
                                    newOrderRespType:"FULL",
                                    sideEffectType : "AUTO_BORROW_REPAY",
                                    /*timeInForce : "GTC", *//* mandatory for limit orders */
                                    timestamp
                            };
            console.log(params);

             let queryString = Object.keys(params).map(key=> `${key}=${encodeURIComponent(params[key])}`).join("&");

                    const signature = crypto.createHmac("sha256", apiSecret)
                    .update(queryString)
                    .digest("hex");

                    queryString+="&signature="+signature;

                    const url = endpoint + "?" + queryString;
                    const request = await  fetch(url, {
                                    method:"POST",
                                    headers:{
                                                        "X-MBX-APIKEY": apiKey,
                                                        "Content-Type": "application/x-www-form-urlencoded"
                                                    }
                                })

                    const response = await request.json();
                    return response;

    }catch(error){
             console.log("Error", error)
             throw error;
    }
}





module.exports.getTickerPrice   = getTickerPrice; // OK  no need to replace.
module.exports.formatter        = formatter; // ok
module.exports.sellShortCross   = sellShortCross; //OKto be tested change it to cross 3x
module.exports.getCrossDebt     = getCrossDebt; //OK  
module.exports.stopBuy          = stopBuy; // OK 
module.exports.cancelCrossOrders= cancelCrossOrders;// OK !.
