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
async function isAboveMa(x){
	    try {
		            const priceFetch = await fetch(`http://16.170.155.76:5000/sig`);

		            const data       = await priceFetch.json();
                    const _ma25       = data.ma25;
                    const _ma100       = data.ma100;
                    
                    const ma25      = formatter(_ma25,1,2);
                    const ma100      = formatter(_ma100,1,2);

		            const maPrice    = ma25/*extract price*/;
		            const isAboveMa25   = x>=ma25*1.0014; /* true if x is 0.14% above ma*/
                    const ma25AboveMa100 = ma25>= ma100*0.9999;
                    const b = isAboveMa25 && ma25AboveMa100; 
		            const obj = {isAbove: b, maPrice: maPrice}
		            //console.log(obj);
		            return obj ;
		        }catch(err){
				        console.error("err in isAboveMa : ", err);
				        throw error;
				    }
}

async function isAboveSlowMa(x){
	    try {
		            const priceFetch = await fetch(`http://16.170.155.76:5000/sig`);
		            const data       = await priceFetch.json();
                    const _ma100     = data.ma100;
                    const ma100      = formatter(_ma100,1,2);

		            const maPrice    = ma100/*extract price*/;
		            const isAboveMa100   = x>=ma100; /* true if x is 0.14% above ma*/
                    const b = isAboveMa100 ; 
		            const obj = {isAbove: b, maPrice: maPrice}
		            return obj ;
		        }catch(err){
				        console.error("err in isAboveMa : ", err);
				        throw error;
				}
}


module.exports.getTickerPrice   = getTickerPrice;
module.exports.formatter        = formatter;
module.exports.isAboveMa        = isAboveMa;
module.exports.isAboveSlowMa    = isAboveSlowMa;
