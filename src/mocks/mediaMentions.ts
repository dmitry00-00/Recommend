// Сгенерировано tools/build-media-mentions.mts (2026-10-07) из разметки модели
// (.cache/llm/labels.json): в скольких подборках, роликах о нескольких и новостях названо произведение;
// темы роликов без произведения. Это догадка модели, а не решение человека. Не править руками.
export interface MediaMentions { list?: number; several?: number; news?: number }

export const mediaMentions: { labels: number; works: Record<string, MediaMentions>; topics: { name: string; type?: string; n: number }[] } = {
 "labels": 2356,
 "works": {
  "imdb:tt9660182": {
   "news": 1
  },
  "imdb:tt0853174": {
   "list": 3
  },
  "tmdb:550": {
   "news": 1,
   "several": 2,
   "list": 1
  },
  "tmdb:848700": {
   "news": 1
  },
  "tmdb:269149": {
   "several": 2,
   "list": 1
  },
  "tmdb:466272": {
   "news": 1,
   "several": 4
  },
  "tmdb:318846": {
   "several": 1
  },
  "tmdb:10673": {
   "several": 1
  },
  "imdb:tt0944947": {
   "news": 76,
   "several": 49,
   "list": 18
  },
  "tmdb:123": {
   "news": 6,
   "several": 3,
   "list": 1
  },
  "tmdb:245891": {
   "news": 2,
   "several": 2
  },
  "imdb:tt11198330": {
   "news": 52,
   "several": 42,
   "list": 14
  },
  "imdb:tt27497448": {
   "news": 4,
   "several": 2
  },
  "wd:Q473": {
   "several": 1
  },
  "imdb:tt2306299": {
   "several": 2,
   "list": 1
  },
  "imdb:tt5180504": {
   "several": 6,
   "news": 4,
   "list": 2
  },
  "tmdb:639933": {
   "list": 1
  },
  "imdb:tt2861424": {
   "list": 1
  },
  "wd:Q15228": {
   "several": 1,
   "news": 1
  },
  "wd:Q483412": {
   "several": 1
  },
  "tmdb:49521": {
   "several": 1,
   "news": 1,
   "list": 1
  },
  "tmdb:617126": {
   "list": 1
  },
  "tmdb:507086": {
   "list": 1
  },
  "imdb:tt10919420": {
   "news": 1,
   "several": 1
  },
  "tmdb:10191": {
   "several": 2
  },
  "tmdb:82702": {
   "several": 1
  },
  "tmdb:166428": {
   "several": 2
  },
  "tmdb:24428": {
   "news": 1,
   "list": 1,
   "several": 3
  },
  "tmdb:68726": {
   "news": 1
  },
  "imdb:tt9253284": {
   "several": 1
  },
  "imdb:tt3581920": {
   "several": 1,
   "news": 1
  },
  "imdb:tt3322312": {
   "several": 1
  },
  "imdb:tt11126994": {
   "several": 1
  },
  "tmdb:1241982": {
   "several": 1
  },
  "tmdb:558449": {
   "several": 2,
   "news": 1
  },
  "tmdb:516729": {
   "several": 1
  },
  "tmdb:1080252": {
   "news": 1
  },
  "tmdb:529106": {
   "news": 1
  },
  "tmdb:475557": {
   "list": 1,
   "news": 1,
   "several": 1
  },
  "tmdb:337404": {
   "list": 1
  },
  "tmdb:808": {
   "list": 1,
   "several": 1
  },
  "tmdb:4011": {
   "several": 1
  },
  "tmdb:268": {
   "several": 1,
   "list": 1
  },
  "tmdb:12092": {
   "several": 1
  },
  "tmdb:252": {
   "several": 1
  },
  "tmdb:522627": {
   "several": 1
  },
  "imdb:tt12262202": {
   "news": 2
  },
  "imdb:tt1865718": {
   "news": 1,
   "list": 4,
   "several": 1
  },
  "tmdb:20870": {
   "list": 1
  },
  "tmdb:21028": {
   "list": 1
  },
  "tmdb:43430": {
   "list": 1
  },
  "tmdb:49802": {
   "list": 1
  },
  "tmdb:77069": {
   "list": 1
  },
  "tmdb:38055": {
   "several": 2
  },
  "tmdb:9502": {
   "several": 1
  },
  "imdb:tt6741278": {
   "list": 1
  },
  "tmdb:167858": {
   "list": 1
  },
  "tmdb:338970": {
   "news": 1
  },
  "tmdb:1271": {
   "news": 1,
   "list": 1
  },
  "tmdb:8077": {
   "several": 1
  },
  "tmdb:807": {
   "several": 1
  },
  "tmdb:1949": {
   "several": 1
  },
  "tmdb:424783": {
   "list": 1
  },
  "tmdb:324857": {
   "several": 2
  },
  "tmdb:569094": {
   "several": 2,
   "news": 1
  },
  "tmdb:75656": {
   "several": 1
  },
  "tmdb:68728": {
   "several": 1
  },
  "tmdb:15512": {
   "list": 1
  },
  "tmdb:284052": {
   "list": 1
  },
  "imdb:tt0412142": {
   "list": 1
  },
  "tmdb:785084": {
   "several": 1
  },
  "tmdb:315162": {
   "several": 1
  },
  "tmdb:76600": {
   "several": 2,
   "list": 1,
   "news": 1
  },
  "tmdb:19995": {
   "several": 3,
   "list": 2,
   "news": 1
  },
  "tmdb:280": {
   "several": 1
  },
  "tmdb:597": {
   "several": 1
  },
  "tmdb:121": {
   "several": 1,
   "list": 1
  },
  "tmdb:505642": {
   "several": 1
  },
  "tmdb:436270": {
   "several": 1,
   "news": 3
  },
  "tmdb:1771": {
   "several": 1,
   "list": 1
  },
  "tmdb:1726": {
   "several": 1,
   "list": 1
  },
  "tmdb:10138": {
   "several": 1,
   "list": 1
  },
  "tmdb:1724": {
   "several": 1
  },
  "tmdb:10195": {
   "several": 1
  },
  "tmdb:617653": {
   "several": 2,
   "list": 1
  },
  "tmdb:804": {
   "several": 1
  },
  "tmdb:762": {
   "several": 1
  },
  "tmdb:10235": {
   "several": 1,
   "list": 1
  },
  "tmdb:953": {
   "several": 2
  },
  "imdb:tt8466564": {
   "news": 1
  },
  "tmdb:123678": {
   "news": 1
  },
  "imdb:tt10234724": {
   "several": 2
  },
  "tmdb:414906": {
   "several": 1,
   "news": 1
  },
  "imdb:tt5753856": {
   "several": 1
  },
  "tmdb:295830": {
   "several": 1
  },
  "tmdb:296524": {
   "list": 1,
   "several": 1
  },
  "tmdb:39538": {
   "list": 1
  },
  "tmdb:76649": {
   "list": 1
  },
  "tmdb:634649": {
   "several": 1,
   "list": 1
  },
  "tmdb:624860": {
   "several": 1,
   "news": 1,
   "list": 1
  },
  "tmdb:722778": {
   "several": 1
  },
  "tmdb:603": {
   "list": 4,
   "news": 1,
   "several": 2
  },
  "tmdb:511809": {
   "news": 2
  },
  "tmdb:185": {
   "news": 1
  },
  "tmdb:576845": {
   "list": 1,
   "news": 1
  },
  "tmdb:568124": {
   "list": 1,
   "news": 1
  },
  "tmdb:588182": {
   "news": 1
  },
  "tmdb:264685": {
   "list": 1
  },
  "tmdb:68722": {
   "list": 1
  },
  "tmdb:238": {
   "several": 1,
   "list": 1
  },
  "tmdb:36557": {
   "several": 1
  },
  "tmdb:500": {
   "several": 2
  },
  "tmdb:680": {
   "several": 5
  },
  "tmdb:68718": {
   "several": 4,
   "news": 1
  },
  "tmdb:72559": {
   "several": 1
  },
  "tmdb:436969": {
   "list": 1,
   "several": 1
  },
  "tmdb:550988": {
   "list": 1
  },
  "tmdb:459151": {
   "list": 1
  },
  "tmdb:497698": {
   "several": 1
  },
  "tmdb:609490": {
   "several": 1,
   "news": 1
  },
  "tmdb:103": {
   "several": 1,
   "list": 1
  },
  "tmdb:43685": {
   "list": 1
  },
  "tmdb:265180": {
   "list": 1
  },
  "tmdb:16869": {
   "news": 1
  },
  "tmdb:385128": {
   "news": 1
  },
  "tmdb:602734": {
   "several": 1
  },
  "imdb:tt7366338": {
   "news": 2,
   "several": 1
  },
  "tmdb:600354": {
   "news": 1
  },
  "tmdb:8413": {
   "several": 1
  },
  "tmdb:10153": {
   "several": 1
  },
  "tmdb:137113": {
   "news": 1
  },
  "tmdb:20992": {
   "several": 1
  },
  "tmdb:20993": {
   "several": 1
  },
  "tmdb:1184918": {
   "several": 3,
   "list": 1
  },
  "tmdb:78": {
   "several": 1
  },
  "imdb:tt2580046": {
   "several": 1
  },
  "imdb:tt1190634": {
   "several": 5,
   "list": 2
  },
  "tmdb:181812": {
   "news": 1
  },
  "tmdb:698687": {
   "list": 1,
   "several": 2
  },
  "tmdb:353486": {
   "several": 1
  },
  "tmdb:512200": {
   "several": 1
  },
  "tmdb:515001": {
   "several": 2
  },
  "tmdb:496243": {
   "several": 1
  },
  "tmdb:8587": {
   "list": 1
  },
  "tmdb:420818": {
   "list": 1
  },
  "tmdb:32334": {
   "list": 1
  },
  "tmdb:12": {
   "list": 1
  },
  "tmdb:694": {
   "several": 1
  },
  "tmdb:501170": {
   "several": 1
  },
  "tmdb:474350": {
   "news": 1
  },
  "tmdb:68721": {
   "list": 1
  },
  "tmdb:100402": {
   "list": 1
  },
  "imdb:tt0411008": {
   "list": 1
  },
  "tmdb:812": {
   "several": 1
  },
  "tmdb:420817": {
   "several": 1
  },
  "tmdb:447404": {
   "several": 1
  },
  "tmdb:458156": {
   "several": 2
  },
  "tmdb:299534": {
   "several": 1,
   "list": 1,
   "news": 2
  },
  "tmdb:299536": {
   "several": 1,
   "news": 2
  },
  "tmdb:99861": {
   "several": 1,
   "list": 1
  },
  "tmdb:137106": {
   "list": 1
  },
  "imdb:tt0096697": {
   "list": 2
  },
  "tmdb:571419": {
   "several": 1
  },
  "tmdb:375262": {
   "several": 1
  },
  "tmdb:321612": {
   "list": 1
  },
  "tmdb:10020": {
   "list": 1
  },
  "tmdb:102651": {
   "list": 1
  },
  "tmdb:557": {
   "list": 3,
   "news": 1
  },
  "tmdb:338952": {
   "news": 1
  },
  "wd:Q1751870": {
   "several": 10,
   "list": 1
  },
  "tmdb:446021": {
   "several": 1
  },
  "imdb:tt2758770": {
   "list": 2
  },
  "imdb:tt0121955": {
   "list": 1
  },
  "tmdb:439015": {
   "news": 1
  },
  "tmdb:458423": {
   "news": 1
  },
  "tmdb:284054": {
   "list": 1
  },
  "tmdb:383498": {
   "several": 1
  },
  "tmdb:348350": {
   "several": 1
  },
  "tmdb:434355": {
   "news": 1
  },
  "tmdb:440626": {
   "several": 1
  },
  "tmdb:399174": {
   "several": 1
  },
  "tmdb:1416281": {
   "list": 1
  },
  "tmdb:24021": {
   "several": 1
  },
  "tmdb:622": {
   "several": 1
  },
  "tmdb:359940": {
   "several": 2
  },
  "tmdb:440627": {
   "several": 1
  },
  "tmdb:389015": {
   "several": 1
  },
  "tmdb:301337": {
   "several": 1
  },
  "tmdb:406997": {
   "several": 1
  },
  "tmdb:395458": {
   "several": 1
  },
  "tmdb:298250": {
   "several": 1
  },
  "tmdb:471968": {
   "several": 2
  },
  "tmdb:376540": {
   "several": 1
  },
  "tmdb:335984": {
   "list": 1
  },
  "tmdb:9323": {
   "list": 1
  },
  "tmdb:378236": {
   "several": 1
  },
  "tmdb:390043": {
   "several": 1
  },
  "wd:Q40205": {
   "several": 1
  },
  "tmdb:83542": {
   "several": 1
  },
  "tmdb:339846": {
   "several": 1
  },
  "tmdb:9799": {
   "several": 1
  },
  "tmdb:384682": {
   "news": 1
  },
  "tmdb:131242": {
   "news": 1
  },
  "imdb:tt0852863": {
   "list": 1
  },
  "imdb:tt0784896": {
   "list": 1
  },
  "tmdb:376565": {
   "several": 1
  },
  "tmdb:1059064": {
   "several": 1
  },
  "tmdb:297761": {
   "several": 1,
   "list": 1,
   "news": 1
  },
  "tmdb:36657": {
   "list": 1,
   "several": 1
  },
  "tmdb:209112": {
   "several": 2,
   "list": 1
  },
  "tmdb:271110": {
   "several": 2,
   "news": 1
  },
  "tmdb:325348": {
   "several": 1
  },
  "tmdb:278927": {
   "several": 1
  },
  "tmdb:205584": {
   "several": 1
  },
  "tmdb:293660": {
   "list": 1,
   "news": 1,
   "several": 1
  },
  "tmdb:21135": {
   "several": 1
  },
  "tmdb:216015": {
   "several": 1
  },
  "tmdb:1832": {
   "list": 1
  },
  "tmdb:278": {
   "list": 2
  },
  "tmdb:602": {
   "list": 1,
   "several": 1
  },
  "tmdb:140300": {
   "several": 1
  },
  "tmdb:306819": {
   "several": 1
  },
  "tmdb:298312": {
   "several": 1
  },
  "tmdb:105864": {
   "several": 1
  },
  "tmdb:4488": {
   "list": 1
  },
  "tmdb:1366": {
   "list": 1
  },
  "tmdb:335724": {
   "news": 1,
   "several": 1
  },
  "tmdb:150088": {
   "several": 1
  },
  "tmdb:71831": {
   "several": 1
  },
  "tmdb:512195": {
   "several": 1
  },
  "tmdb:85": {
   "several": 1
  },
  "tmdb:87": {
   "several": 1
  },
  "tmdb:89": {
   "several": 1
  },
  "imdb:tt0903747": {
   "several": 6,
   "list": 3
  },
  "imdb:tt3032476": {
   "several": 2,
   "list": 1
  },
  "tmdb:1891": {
   "list": 2
  },
  "tmdb:1892": {
   "list": 1
  },
  "tmdb:140607": {
   "list": 1
  },
  "tmdb:11104": {
   "several": 1
  },
  "tmdb:351145": {
   "list": 1
  },
  "tmdb:253412": {
   "several": 1
  },
  "tmdb:98": {
   "several": 1
  },
  "tmdb:348": {
   "several": 4,
   "list": 2,
   "news": 1
  },
  "imdb:tt7631058": {
   "several": 2
  },
  "imdb:tt7462410": {
   "list": 1
  },
  "tmdb:438631": {
   "several": 1
  },
  "tmdb:76757": {
   "several": 1
  },
  "tmdb:70160": {
   "several": 1,
   "list": 1
  },
  "tmdb:8966": {
   "several": 1
  },
  "tmdb:273248": {
   "several": 4
  },
  "imdb:tt0141842": {
   "several": 1
  },
  "tmdb:198184": {
   "several": 1
  },
  "tmdb:17654": {
   "several": 2
  },
  "tmdb:68724": {
   "several": 1,
   "list": 1
  },
  "tmdb:935": {
   "list": 1
  },
  "tmdb:600": {
   "list": 1
  },
  "tmdb:616037": {
   "news": 1
  },
  "imdb:tt0475784": {
   "news": 4
  },
  "tmdb:118340": {
   "news": 1,
   "list": 1,
   "several": 1
  },
  "tmdb:338517": {
   "several": 1
  },
  "tmdb:49106": {
   "several": 1
  },
  "imdb:tt1695360": {
   "several": 1
  },
  "tmdb:4944": {
   "several": 1,
   "list": 1
  },
  "tmdb:9806": {
   "several": 1
  },
  "tmdb:10386": {
   "several": 1
  },
  "tmdb:585": {
   "several": 1
  },
  "tmdb:862": {
   "several": 1
  },
  "tmdb:41154": {
   "several": 1
  },
  "tmdb:27205": {
   "several": 1
  },
  "tmdb:315635": {
   "news": 1
  },
  "tmdb:68": {
   "several": 1
  },
  "tmdb:76341": {
   "several": 1
  },
  "tmdb:9659": {
   "several": 1,
   "list": 1,
   "news": 1
  },
  "wd:Q70469944": {
   "list": 1,
   "several": 2
  },
  "tmdb:297762": {
   "news": 1
  },
  "tmdb:558": {
   "list": 1
  },
  "tmdb:559": {
   "list": 1
  },
  "tmdb:1930": {
   "list": 2
  },
  "tmdb:33065": {
   "several": 1
  },
  "tmdb:324552": {
   "several": 1
  },
  "tmdb:141052": {
   "list": 1
  },
  "tmdb:670": {
   "several": 1
  },
  "tmdb:373571": {
   "several": 1
  },
  "tmdb:412117": {
   "several": 1
  },
  "imdb:tt0149460": {
   "list": 1
  },
  "imdb:tt0898266": {
   "list": 1
  },
  "tmdb:5548": {
   "list": 1
  },
  "imdb:tt13918446": {
   "list": 2
  },
  "tmdb:11": {
   "news": 1
  },
  "tmdb:120467": {
   "several": 1
  },
  "tmdb:747188": {
   "several": 1
  },
  "imdb:tt10857164": {
   "several": 1
  },
  "tmdb:1083381": {
   "several": 1
  },
  "tmdb:13475": {
   "several": 1
  },
  "tmdb:589761": {
   "several": 1
  },
  "tmdb:431": {
   "news": 1
  },
  "tmdb:4248": {
   "list": 1
  },
  "tmdb:8363": {
   "list": 1
  },
  "tmdb:18785": {
   "list": 1
  },
  "tmdb:986056": {
   "news": 1
  },
  "tmdb:246655": {
   "several": 1
  },
  "tmdb:36658": {
   "several": 1
  },
  "tmdb:335797": {
   "several": 1
  },
  "tmdb:539": {
   "several": 1
  },
  "tmdb:361743": {
   "news": 1
  },
  "imdb:tt2085059": {
   "several": 1
  },
  "tmdb:839": {
   "several": 1
  },
  "tmdb:598014": {
   "list": 1
  },
  "tmdb:1081003": {
   "news": 1
  },
  "tmdb:109445": {
   "list": 1
  },
  "imdb:tt4574334": {
   "news": 1
  },
  "tmdb:643": {
   "list": 1
  },
  "tmdb:272": {
   "list": 1
  },
  "tmdb:155": {
   "list": 1,
   "several": 1
  },
  "tmdb:49026": {
   "list": 1
  },
  "tmdb:587": {
   "list": 1
  },
  "tmdb:197": {
   "list": 1
  },
  "tmdb:545611": {
   "news": 1
  },
  "tmdb:313369": {
   "several": 1
  },
  "tmdb:91314": {
   "list": 1
  },
  "tmdb:8373": {
   "list": 1
  },
  "tmdb:38356": {
   "list": 1
  },
  "tmdb:13183": {
   "news": 1
  },
  "tmdb:497": {
   "list": 1
  },
  "imdb:tt0306414": {
   "list": 1
  },
  "tmdb:929590": {
   "several": 2
  },
  "tmdb:791373": {
   "several": 1,
   "news": 1
  },
  "tmdb:401513": {
   "several": 1
  },
  "wd:Q202975": {
   "several": 2
  },
  "tmdb:1316092": {
   "several": 1
  },
  "tmdb:170": {
   "several": 1,
   "list": 1
  },
  "tmdb:346698": {
   "list": 1
  },
  "tmdb:1422": {
   "list": 1
  },
  "tmdb:23823": {
   "several": 1
  },
  "tmdb:9902": {
   "several": 1
  },
  "tmdb:62177": {
   "list": 1
  },
  "tmdb:49013": {
   "list": 1
  },
  "tmdb:14160": {
   "list": 1
  },
  "tmdb:581734": {
   "news": 1
  },
  "tmdb:603692": {
   "several": 1
  },
  "tmdb:726759": {
   "several": 1
  },
  "tmdb:9495": {
   "several": 1
  },
  "tmdb:679694": {
   "several": 1
  },
  "imdb:tt0182576": {
   "list": 1
  },
  "wd:Q17027653": {
   "several": 1
  },
  "tmdb:546554": {
   "list": 1
  },
  "tmdb:127585": {
   "several": 1
  },
  "tmdb:49538": {
   "several": 1
  },
  "tmdb:76170": {
   "several": 1
  },
  "imdb:tt0096684": {
   "several": 1
  },
  "tmdb:2062": {
   "several": 1
  },
  "tmdb:644495": {
   "several": 1
  },
  "imdb:tt14269590": {
   "several": 1
  },
  "tmdb:18": {
   "list": 1
  },
  "tmdb:646380": {
   "list": 1
  },
  "tmdb:8656": {
   "list": 1
  },
  "tmdb:278154": {
   "list": 1
  },
  "tmdb:444218": {
   "news": 1
  },
  "tmdb:11906": {
   "several": 1
  },
  "tmdb:361292": {
   "several": 1
  },
  "tmdb:10730": {
   "list": 1
  },
  "tmdb:8844": {
   "list": 1
  },
  "tmdb:468987": {
   "list": 1
  },
  "tmdb:52891": {
   "list": 1
  },
  "tmdb:90804": {
   "list": 1
  },
  "tmdb:166426": {
   "several": 1
  },
  "tmdb:101": {
   "several": 1
  },
  "tmdb:42726": {
   "several": 1
  },
  "tmdb:52939": {
   "list": 1
  },
  "tmdb:154922": {
   "list": 1
  },
  "tmdb:314946": {
   "list": 1
  },
  "tmdb:422058": {
   "list": 1
  },
  "tmdb:492618": {
   "list": 1
  },
  "tmdb:45612": {
   "several": 1
  },
  "tmdb:141": {
   "several": 1
  },
  "tmdb:37799": {
   "news": 1
  },
  "tmdb:11619": {
   "list": 1
  },
  "imdb:tt8111088": {
   "news": 1
  },
  "imdb:tt1409069": {
   "news": 1
  },
  "tmdb:1327819": {
   "list": 1
  },
  "tmdb:12155": {
   "several": 1
  },
  "imdb:tt30023782": {
   "several": 1
  },
  "tmdb:10681": {
   "list": 1
  },
  "tmdb:9928": {
   "list": 1
  },
  "tmdb:41513": {
   "list": 1
  },
  "imdb:tt0238784": {
   "several": 1
  },
  "tmdb:106": {
   "list": 1
  },
  "tmdb:169": {
   "list": 1
  },
  "tmdb:346910": {
   "list": 1
  },
  "tmdb:1250": {
   "list": 1
  },
  "tmdb:8922": {
   "list": 1
  },
  "tmdb:860508": {
   "several": 1
  },
  "imdb:tt9208876": {
   "several": 1
  },
  "tmdb:822119": {
   "several": 1
  },
  "tmdb:969681": {
   "news": 3,
   "list": 1
  },
  "tmdb:1084244": {
   "news": 1
  },
  "tmdb:562": {
   "several": 1
  }
 },
 "topics": [
  {
   "name": "игра престолов",
   "type": "franchise",
   "n": 14
  },
  {
   "name": "кино",
   "type": "industry",
   "n": 13
  },
  {
   "name": "киноиндустрия",
   "type": "industry",
   "n": 9
  },
  {
   "name": "game of thrones",
   "type": "theme",
   "n": 8
  },
  {
   "name": "game of thrones",
   "type": "franchise",
   "n": 7
  },
  {
   "name": "house of the dragon",
   "type": "franchise",
   "n": 6
  },
  {
   "name": "супергероика",
   "type": "genre",
   "n": 5
  },
  {
   "name": "a song of ice and fire",
   "type": "franchise",
   "n": 3
  },
  {
   "name": "дом дракона",
   "type": "franchise",
   "n": 3
  },
  {
   "name": "хоррор",
   "type": "genre",
   "n": 3
  },
  {
   "name": "стрим",
   "type": "theme",
   "n": 3
  },
  {
   "name": "киберпанк",
   "type": "genre",
   "n": 3
  },
  {
   "name": "crusader kings 2",
   "type": "game",
   "n": 3
  },
  {
   "name": "телевидение",
   "type": "industry",
   "n": 3
  },
  {
   "name": "фэнтези",
   "type": "genre",
   "n": 3
  },
  {
   "name": "кино",
   "type": "genre",
   "n": 2
  },
  {
   "name": "видеоигры",
   "type": "industry",
   "n": 2
  },
  {
   "name": "сериалы",
   "type": "theme",
   "n": 2
  },
  {
   "name": "трэш",
   "type": "theme",
   "n": 2
  },
  {
   "name": "crusader kings 2",
   "type": "franchise",
   "n": 2
  },
  {
   "name": "психологический портрет",
   "type": "genre",
   "n": 2
  }
 ]
};
