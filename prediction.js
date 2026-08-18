/* 小苏预测板块静态数据：由 predict.py 基于 data/.py 算法生成 */
window.PREDICTION = {
  "updatedAt": "2026-08-18",
  "source": "data/ 技术指标算法（MA/MACD/KDJ/RSI/BIAS/OBV）· 前复权日K线",
  "stocks": [
    {
      "name": "水晶光电",
      "code": "002273",
      "price": 29.0,
      "changePct": -0.34,
      "score": 89,
      "signal": "强烈利好",
      "ind": {
        "ma5": 28.05,
        "ma10": 27.64,
        "ma20": 26.92,
        "maArr": "多头排列(5>10>20)",
        "macd": 1.18,
        "macdState": "红柱·多头",
        "k": 83.9,
        "d": 78.8,
        "j": 68.7,
        "kdjState": "金叉·未超买",
        "rsi24": 58.3,
        "rsiState": "强势区",
        "bias5": 3.4,
        "biasState": "乖离合理",
        "obvState": "资金持续流入",
        "trendState": "近5日4日上涨",
        "upDays": 4
      },
      "conclusion": "基于 data/ 下技术指标算法对前复权日K线的测算，水晶光电综合利好评分 89/100。当前技术面偏多：均线多头排列、MACD红柱、KDJ金叉未超买、RSI处于强势区间、OBV资金流入、近5日多数上涨。短线以震荡偏多思路看待，建议结合成交量与大盘环境综合判断，本结论仅为技术面参考，不构成投资建议。"
    },
    {
      "name": "巨化股份",
      "code": "600160",
      "price": 40.0,
      "changePct": -2.06,
      "score": 11,
      "signal": "观望",
      "ind": {
        "ma5": 40.83,
        "ma10": 42.08,
        "ma20": 40.91,
        "maArr": "弱势(跌破均线)",
        "macd": -0.009,
        "macdState": "绿柱·空头",
        "k": 26.7,
        "d": 44.3,
        "j": 79.5,
        "kdjState": "死叉·偏弱",
        "rsi24": 50.0,
        "rsiState": "中性区",
        "bias5": -2.02,
        "biasState": "乖离合理",
        "obvState": "资金流出",
        "trendState": "近5日1日上涨",
        "upDays": 1
      },
      "conclusion": "基于 data/ 下技术指标算法对前复权日K线的测算，巨化股份综合利好评分 11/100。当前技术面偏弱：。操作上宜观望或轻仓，建议结合成交量与大盘环境综合判断，本结论仅为技术面参考，不构成投资建议。"
    }
  ]
};
