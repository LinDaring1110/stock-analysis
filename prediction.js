/* 小苏预测板块静态数据：由 predict.py 基于 data/.py 算法生成 */
window.PREDICTION = {
  "updatedAt": "2026-08-14",
  "source": "data/ 技术指标算法（MA/MACD/KDJ/RSI/BIAS/OBV）· 前复权日K线",
  "stocks": [
    {
      "name": "水晶光电",
      "code": "002273",
      "price": 27.62,
      "changePct": 2.45,
      "score": 84,
      "signal": "强烈利好",
      "ind": {
        "ma5": 27.23,
        "ma10": 26.89,
        "ma20": 26.65,
        "maArr": "多头排列(5>10>20)",
        "macd": 0.913,
        "macdState": "红柱·多头",
        "k": 76.1,
        "d": 72.6,
        "j": 65.5,
        "kdjState": "金叉·未超买",
        "rsi24": 58.3,
        "rsiState": "强势区",
        "bias5": 1.42,
        "biasState": "乖离合理",
        "obvState": "资金持续流入",
        "trendState": "近5日3日上涨",
        "upDays": 3
      },
      "conclusion": "基于 data/ 下技术指标算法对前复权日K线的测算，水晶光电综合利好评分 84/100。当前技术面偏多：均线多头排列、MACD红柱、KDJ金叉未超买、RSI处于强势区间、OBV资金流入。短线以震荡偏多思路看待，建议结合成交量与大盘环境综合判断，本结论仅为技术面参考，不构成投资建议。"
    },
    {
      "name": "巨化股份",
      "code": "600160",
      "price": 40.77,
      "changePct": -1.33,
      "score": 29,
      "signal": "观望",
      "ind": {
        "ma5": 41.95,
        "ma10": 42.12,
        "ma20": 40.79,
        "maArr": "弱势(跌破均线)",
        "macd": 0.319,
        "macdState": "红柱·多头",
        "k": 46.9,
        "d": 62.5,
        "j": 93.7,
        "kdjState": "死叉·偏弱",
        "rsi24": 50.0,
        "rsiState": "中性区",
        "bias5": -2.82,
        "biasState": "乖离合理",
        "obvState": "资金流出",
        "trendState": "近5日2日上涨",
        "upDays": 2
      },
      "conclusion": "基于 data/ 下技术指标算法对前复权日K线的测算，巨化股份综合利好评分 29/100。当前技术面偏弱：MACD红柱。操作上宜观望或轻仓，建议结合成交量与大盘环境综合判断，本结论仅为技术面参考，不构成投资建议。"
    }
  ]
};
