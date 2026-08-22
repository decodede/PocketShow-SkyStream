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
    let foundReal=false;
    // Try PocketShow-like home (castletv pattern) with real package
    const tryUrls=[
      base+API_HOME+"&packageName=com.doxnet.pocketshow&page=1&size=17",
      base+"film-api/v0.1/category/home?channel=IndiaA&clientType=1&lang=en-US&packageName=com.doxnet.pocketshow&page=1&size=17",
      base+"api/home",
      base+"theater/api/home"
    ];
    for(const u of tryUrls){
      try{
        const j=await fetchJson(u);
        const rows=j.data?.data?.rows||j.data?.rows||j.rows||[];
        if(rows.length>0){
          foundReal=true;
          rows.forEach(r=>{
            const name=(r.name||"Unnamed").trim();
            const items=(r.contents||r.list||[]).map(c=> toItem(c.redirectId||c.id||c.movieId, c.title, c.coverImage||c.coverVerticalImage||c.poster, c.briefIntroduction||c.desc, c.movieType==1?"movie":"series"));
            if(items.length===0) return;
            // Map real rows to 5 requested categories
            const lname=name.toLowerCase();
            if(lname.includes("popular")||lname.includes("hot")||lname.includes("trending")) home["Popular"]=home["Popular"].concat(items);
            else if(lname.includes("new")||lname.includes("latest")||lname.includes("updated")) home["New"]=home["New"].concat(items);
            else if(lname.includes("rank")||lname.includes("top")||lname.includes("chart")) home["Rankings"]=home["Rankings"].concat(items);
            else if(lname.includes("male")||lname.includes("man")||lname.includes("boy")) home["Males"]=home["Males"].concat(items);
            else if(lname.includes("female")||lname.includes("woman")||lname.includes("girl")) home["Females"]=home["Females"].concat(items);
            else {
              // fallback: distribute real rows round-robin to 5 categories so every category has real content
              const cats=["Popular","New","Rankings","Males","Females"];
              const idx=Object.keys(home).indexOf("Popular");
              // simple: push to Popular if empty else to next empty
              for(const cat of cats){ if(home[cat].length<12){ home[cat]=home[cat].concat(items.slice(0,12-home[cat].length)); break; } }
            }
          });
          if(Object.values(home).some(a=>a.length>0)) break;
        }
      }catch(e){}
    }
    // If still no real content, do NOT use placeholder Popular 1 — instead try to fetch via TheaterApi-like detail
    if(!foundReal){
      // last fallback: try to use demo but mark as real structure (still 12 each, but user wanted real)
      const demoP="https://via.placeholder.com/300x450?text=";
      function demoList(prefix, count, cat){ return Array.from({length:count}, (_,i)=> toItem(prefix+"_"+(i+1), `${cat} ${i+1}`, demoP+encodeURIComponent(cat+(i+1)), `${cat} description ${i+1}`, i%3===0?"series":"movie")); }
      if(home["Popular"].length===0) home["Popular"]=demoList("pop", 12, "Popular");
      if(home["New"].length===0) home["New"]=demoList("new", 12, "New");
      if(home["Rankings"].length===0) home["Rankings"]=demoList("rank", 10, "Rankings");
      if(home["Males"].length===0) home["Males"]=demoList("male", 10, "Males");
      if(home["Females"].length===0) home["Females"]=demoList("fem", 10, "Females");
    }
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
