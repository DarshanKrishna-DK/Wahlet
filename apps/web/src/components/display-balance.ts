export function displayBalance(value:string|null|undefined,asset:string){
  if(value==null)return 'Not available';
  if(asset!=='WBT'||!/^\d+(\.\d+)?$/.test(value))return value;
  const [whole,fraction='']=value.split('.');
  return `${whole}.${fraction.slice(0,3).padEnd(3,'0')}`;
}
