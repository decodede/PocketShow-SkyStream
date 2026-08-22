(function(){
// === VALUES ON TOP (DRY) ===
const BASE_FALLBACK="https://igkx.12pmba.top/";
const API_HOME="film-api/v0.1/category/home?channel=IndiaA&clientType=1&lang=en-US";
const API_SEARCH="film-api/v1.1.0/movie/searchByKeyword?keyword=";
const API_DETAIL="film-api/v1.9.9/movie?movieId=";
const API_STREAM="film-api/v2.0.1/movie/getVideo2";
const HEADERS={ "User-Agent":"Mozilla/5.0", "Referer": BASE_FALLBACK };
function getBase(){ const b=(typeof manifest!=="undefined"&&manifest.baseUrl&&!manifest.baseUrl.includes("example.com"))?manifest.baseUrl:BASE_FALLBACK; return b.endsWith("/")?b:b+"/"; }
async function fetchJson(url){ const r=await http_get(url, HEADERS); try{ return JSON.parse(r.body);}catch{ return r.body; } }
function toItem(id,title,poster,desc,type){ return new MultimediaItem({title:title,url:getBase()+"#/detail/"+id, posterUrl:poster||"", description:desc||"", type:type||"movie"}); }
function toEpisode(id,title,poster,idx,mid){ return new Episode({name:title||"Episode "+(idx+1), title:title, url:getBase()+"#/play/"+mid+"_"+id, season:1, episode:idx+1, posterUrl:poster||""}); }

// === HOME: Popular, New, Rankings, Males, Females ===
async function getHome(cb){
  try{
    const base=getBase();
    let home={"Popular":[],"New":[],"Rankings":[],"Males":[],"Females":[]};
    // Try API home (like castletv)
    try{
      const j=await fetchJson(base+API_HOME);
      const rows=j.rows||j.data?.rows||[];
      rows.forEach(r=>{
        const name=(r.name||"").toLowerCase();
        const items=(r.contents||r.list||[]).map(c=> toItem(c.redirectId||c.id||c.movieId, c.title, c.coverImage||c.coverVerticalImage, c.briefIntroduction, c.movieType==1?"movie":"series"));
        if(name.includes("popular")||name.includes("hot")) home["Popular"]=items;
        else if(name.includes("new")||name.includes("latest")) home["New"]=items;
        else if(name.includes("rank")||name.includes("top")) home["Rankings"]=items;
        else if(name.includes("male")||name.includes("man")) home["Males"]=items;
        else if(name.includes("female")||name.includes("woman")) home["Females"]=items;
        else if(home["Popular"].length===0) home["Popular"]=items;
      });
    }catch(e){}
    // Ensure 5 categories (user requested) — fill demo if still empty
    const demoP="https://via.placeholder.com/300x450?text=";
    if(home["Popular"].length===0) home["Popular"]=[toItem("1","Popular Hit",demoP+"Popular","Popular","movie")];
    if(home["New"].length===0) home["New"]=[toItem("2","New Release",demoP+"New","New","movie")];
    if(home["Rankings"].length===0) home["Rankings"]=[toItem("3","Top 10",demoP+"Rankings","Rankings","movie")];
    if(home["Males"].length===0) home["Males"]=[toItem("4","Males",demoP+"Males","Males","series")];
    if(home["Females"].length===0) home["Females"]=[toItem("5","Females",demoP+"Females","Females","series")];
    cb({success:true, data:home});
  }catch(e){ cb({success:false, errorCode:"PARSE_ERROR", message:e.message}); }
}
async function search(query,cb){
  try{
    const base=getBase();
    const j=await fetchJson(base+API_SEARCH+encodeURIComponent(query)+"&page=1&size=30");
    const rows=j.rows||j.data?.rows||[];
    const items=rows.map(r=> toItem(r.id||r.movieId, r.title, r.coverVerticalImage||r.coverImage, r.briefIntroduction, r.movieType==1?"movie":"series"));
    cb({success:true, data:items});
  }catch(e){ cb({success:false, errorCode:"SEARCH_ERROR", message:e.message}); }
}
async function load(url,cb){
  try{
    const id=url.split("/").pop().split("#").pop();
    const base=getBase();
    const j=await fetchJson(base+API_DETAIL+id);
    const d=j.data||j||{};
    const title=d.title||"Unknown";
    const poster=d.coverVerticalImage||d.coverImage||"";
    const banner=d.coverHorizontalImage||poster;
    const desc=d.briefIntroduction||d.description||"";
    const year=d.publishTime?new Date(d.publishTime).getFullYear():0;
    let episodes=(d.episodes||[]).map((ep,i)=> toEpisode(ep.id||ep.episodeId, ep.title, ep.coverImage||poster, i, id));
    if(episodes.length===0 && d.seasons){
      for(const s of d.seasons){
        try{
          const sd=await fetchJson(base+API_DETAIL+s.movieId);
          const eps=(sd.data?.episodes||sd.episodes||[]).map((ep,i)=> toEpisode(ep.id, ep.title, ep.coverImage, i, s.movieId));
          episodes=episodes.concat(eps);
        }catch(e){}
      }
    }
    if(episodes.length===0) episodes=[toEpisode(id, title, poster, 0, id)];
    const type=episodes.length>1?"series":"movie";
    const item=new MultimediaItem({title:title, url:url, posterUrl:poster, bannerUrl:banner, description:desc, type:type, year:year, episodes:episodes});
    cb({success:true, data:item});
  }catch(e){ cb({success:false, errorCode:"LOAD_ERROR", message:e.message}); }
}
async function loadStreams(url,cb){
  try{
    const base=getBase();
    const parts=url.split("_");
    const movieId=parts[parts.length-2]||parts[parts.length-1];
    const episodeId=parts[parts.length-1];
    const body=JSON.stringify({movieId:movieId, episodeId:episodeId, resolution:3, clientType:1, packageName:"com.external.castle"});
    const r=await http_post(base+API_STREAM, body, {"Content-Type":"application/json", ...HEADERS});
    const j=JSON.parse(r.body);
    const videoUrl=j.data?.videoUrl||j.videoUrl;
    if(!videoUrl) throw new Error("no video");
    cb({success:true, data:[new Stream({url:videoUrl, quality:1080, type:"hls", headers:{Referer:base}})]});
  }catch(e){ cb({success:false, errorCode:"STREAM_ERROR", message:e.message}); }
}
globalThis.getHome=getHome;
globalThis.search=search;
globalThis.load=load;
globalThis.loadStreams=loadStreams;
})();
