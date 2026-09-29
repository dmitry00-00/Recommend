// Выгрузить все ролики каналов-разборщиков в .cache/youtube/videos.json (для разметки).
//   npx tsx tools/youtube-dump.mts        — нужен YT_API_KEY в .env.local
import { loadEnvFile } from './env-file.mts';
import { fetchChannelVideos } from './youtube-channels.mts';

loadEnvFile();
const key = process.env.YT_API_KEY;
if (!key) { console.error('нужен YT_API_KEY в .env.local'); process.exit(1); }
const videos = await fetchChannelVideos(key);
const long = videos.filter((v) => (v.minutes ?? 0) >= 5).length;
const described = videos.filter((v) => (v.description?.length ?? 0) > 80).length;
console.error(`всего ${videos.length}, длиннее пяти минут ${long}, с описанием ${described}`);
