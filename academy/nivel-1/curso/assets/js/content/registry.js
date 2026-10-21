/* Registro de conteúdo por módulo: cada módulo novo chama AcademyContent.register(mod). */
const AcademyContent={
 isNew(m){return !!m&&Array.isArray(m.lessons)},
 register(mod){
  const i=COURSE.findIndex(c=>mod&&c.id===mod.id);
  if(i<0)throw new Error('Módulo desconhecido: '+(mod&&mod.id));
  const src=Object.entries(mod.sources||{}),gl=mod.glossary||[];
  for(const [k] of src)if(Object.prototype.hasOwnProperty.call(SOURCES,k))throw new Error('Fonte duplicada: '+k);
  const seen=new Set(GLOSSARY.map(g=>String(g[0]).toLowerCase()));
  for(const [t] of gl){const key=String(t).toLowerCase();if(seen.has(key))throw new Error('Termo duplicado: '+t);seen.add(key)}
  for(const [k,v] of src)SOURCES[k]=v;
  for(const [t,s] of gl)GLOSSARY.push([t,s,mod.id]);
  COURSE[i]=mod;
  return mod;
 }
};
const AcademyLabs={};
