export interface NearbyHealthCentre{
  osmId:string;
  name:string;
  latitude:number;
  longitude:number;
  distanceKm:number;
  type:string;
  address:string;
  phone?:string;
  openingHours?:string;
  website?:string;
}

const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];

function haversine(lat1:number,lon1:number,lat2:number,lon2:number){
  const r=6371,toRad=(x:number)=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return r*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function clean(v?:string){return v?.replace(/\s+/g,' ').trim()||''}
function address(t:any){return clean(t['addr:full'])||[t['addr:housenumber'],t['addr:street'],t['addr:place']||t['addr:suburb'],t['addr:city']||t['addr:district'],t['addr:state'],t['addr:postcode']].filter(Boolean).join(', ')||'Address not listed in OpenStreetMap';}
function classify(t:any){
  if(/primary health|\bphc\b/i.test(t.name||''))return 'Primary Health Centre';
  if(t.healthcare==='health_post'||t.amenity==='health_post')return 'Health Post';
  if(t.amenity==='hospital'||t.healthcare==='hospital')return 'Hospital';
  if(t.amenity==='clinic'||t.healthcare==='clinic')return 'Clinic';
  return 'Health Centre';
}
export async function findNearbyHealthCentres(lat:number,lon:number,radius=15000):Promise<NearbyHealthCentre[]>{
  const q=`[out:json][timeout:20];(nwr(around:${radius},${lat},${lon})[amenity=clinic];nwr(around:${radius},${lat},${lon})[healthcare=clinic];nwr(around:${radius},${lat},${lon})[healthcare=centre];nwr(around:${radius},${lat},${lon})[amenity=health_post];nwr(around:${radius},${lat},${lon})[healthcare=health_post];nwr(around:${radius},${lat},${lon})[amenity=hospital][name~"Primary Health|PHC|Health Centre|Health Center",i];);out center tags;`;
  let last:any;
  for(const endpoint of endpoints){
    try{
      const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(q)});
      if(!res.ok)throw new Error(`Nearby facility service returned ${res.status}`);
      const json=await res.json();
      const seen=new Set<string>();
      return (json.elements||[]).map((e:any)=>{
        const la=e.lat??e.center?.lat,lo=e.lon??e.center?.lon,t=e.tags||{};
        if(typeof la!=='number'||typeof lo!=='number')return null;
        const name=clean(t.name)||clean(t['official_name'])||classify(t);
        const key=`${name.toLowerCase()}-${la.toFixed(4)}-${lo.toFixed(4)}`;if(seen.has(key))return null;seen.add(key);
        return {osmId:`${e.type}/${e.id}`,name,latitude:la,longitude:lo,distanceKm:haversine(lat,lon,la,lo),type:classify(t),address:address(t),phone:clean(t['contact:phone']||t.phone)||undefined,openingHours:clean(t.opening_hours)||undefined,website:clean(t['contact:website']||t.website)||undefined} as NearbyHealthCentre;
      }).filter(Boolean).sort((a:NearbyHealthCentre,b:NearbyHealthCentre)=>a.distanceKm-b.distanceKm).slice(0,30);
    }catch(e){last=e}
  }
  throw last||new Error('Nearby healthcare lookup unavailable');
}
export function mapDirectionsUrl(lat:number,lon:number){return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${lat}%2C${lon}`}
export function mapViewUrl(lat:number,lon:number){return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`}
export function getCurrentPosition():Promise<GeolocationPosition>{return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:60000}))}
