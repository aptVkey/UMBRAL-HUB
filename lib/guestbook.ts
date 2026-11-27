import {z} from "zod";

/**
 * Livro de informações para hóspedes (público, aberto por QR Code no alojamento).
 * Os textos de cada alojamento ficam na ficha (property.guestbook), em 5 línguas; as recomendações
 * são partilhadas por localidade (tabela guestbook_recs). Nada das Regras internas é mostrado
 * automaticamente: podem conter códigos de acesso.
 */
export const LANGS=["pt","en","fr","es","de"] as const;
export type Lang=typeof LANGS[number];
export const LANG_LABEL:Record<Lang,string>={pt:"Português",en:"English",fr:"Français",es:"Español",de:"Deutsch"};
export const isLang=(v:unknown):v is Lang=>(LANGS as readonly unknown[]).includes(v);

/** Textos livres do livro (escritos em PT; as outras línguas são traduzidas e podem ser revistas). */
export const GUEST_TEXTS=[
 {key:"welcome",label:"Boas-vindas",hint:"Mensagem de boas-vindas e apresentação curta do alojamento."},
 {key:"arrival",label:"Chegada e check-in",hint:"Como fazer o check-in e o que levar. Sem códigos de portas ou cofres."},
 {key:"departure",label:"Saída e check-out",hint:"O que fazer antes de sair: chaves, lixo, janelas, luzes."},
 {key:"houseRules",label:"Regras da casa",hint:"Fumar, festas, número máximo de hóspedes, animais, danos."},
 {key:"services",label:"Serviços",hint:"Pequeno-almoço, limpeza, troca de toalhas e roupa de cama, berços."},
 {key:"appliances",label:"Equipamentos e instruções",hint:"Aquecimento, ar condicionado, TV, máquinas."},
 {key:"waste",label:"Lixo e reciclagem",hint:"Onde fica o ponto de recolha e como separar."},
 {key:"parking",label:"Estacionamento e acessos",hint:"Onde estacionar, transportes, como chegar."},
 {key:"safety",label:"Segurança",hint:"Onde estão o extintor e a manta corta-fogo, saídas de emergência."},
] as const;
export type GuestTextKey=typeof GUEST_TEXTS[number]["key"];
const longText=z.string().max(6000,"Cada texto pode ter no máximo 6.000 caracteres.");
const shortText=(n:number)=>z.string().trim().max(n,`Máximo de ${n} caracteres.`);
const time=z.string().refine(v=>!v||/^([01]\d|2[0-3]):[0-5]\d$/.test(v),"Hora inválida.");
const url=z.string().max(500).refine(v=>!v||/^https?:\/\/[^\s]+$/.test(v),"Usa um endereço com https://.");
const translations=z.object(Object.fromEntries(LANGS.map(l=>[l,longText.default("")])) as Record<Lang,z.ZodDefault<typeof longText>>);
export const guestbookSchema=z.object({
 published:z.boolean().default(false),
 wifiNetwork:shortText(120).default(""),
 wifiPassword:shortText(120).default(""),
 contactPhone:shortText(40).default(""),
 whatsapp:z.boolean().default(false),
 quietFrom:time.default(""),
 quietTo:time.default(""),
 damageUrl:url.default(""),
 texts:z.object(Object.fromEntries(GUEST_TEXTS.map(t=>[t.key,translations.default(emptyTranslations())])) as Record<GuestTextKey,z.ZodDefault<typeof translations>>).default(emptyTexts()),
});
export type Guestbook=z.infer<typeof guestbookSchema>;
export type Translations=Record<Lang,string>;
function emptyTranslations():Translations{return {pt:"",en:"",fr:"",es:"",de:""}}
function emptyTexts(){return Object.fromEntries(GUEST_TEXTS.map(t=>[t.key,emptyTranslations()])) as Record<GuestTextKey,Translations>}
export const emptyGuestbook=():Guestbook=>guestbookSchema.parse({});
/** Fichas gravadas antes do livro não têm o campo: preenche os valores em falta. */
export const normalizeGuestbook=(g:unknown):Guestbook=>{const r=guestbookSchema.safeParse(g??{});return r.success?r.data:emptyGuestbook()};
/** Texto na língua pedida; se ainda não estiver traduzido, usa o português. */
export const pick=(t:Partial<Translations>|undefined,lang:Lang)=>(t?.[lang]||"").trim()||(t?.pt||"").trim();

/* ---------------------------------------------------------------- Recomendações por localidade */

export const REC_CATEGORIES=["restaurants","cafes","groceries","culture","beaches","activities","shopping","transport","health"] as const;
export type RecCategory=typeof REC_CATEGORIES[number];
export const REC_LABEL:Record<RecCategory,Record<Lang,string>>={
 restaurants:{pt:"Restaurantes",en:"Restaurants",fr:"Restaurants",es:"Restaurantes",de:"Restaurants"},
 cafes:{pt:"Cafés e bares",en:"Cafés & bars",fr:"Cafés et bars",es:"Cafeterías y bares",de:"Cafés & Bars"},
 groceries:{pt:"Supermercados e mercearias",en:"Supermarkets & groceries",fr:"Supermarchés et épiceries",es:"Supermercados y tiendas",de:"Supermärkte & Lebensmittel"},
 culture:{pt:"Cultura e visitas",en:"Culture & sightseeing",fr:"Culture et visites",es:"Cultura y visitas",de:"Kultur & Sehenswürdigkeiten"},
 beaches:{pt:"Praias",en:"Beaches",fr:"Plages",es:"Playas",de:"Strände"},
 activities:{pt:"Atividades e natureza",en:"Activities & nature",fr:"Activités et nature",es:"Actividades y naturaleza",de:"Aktivitäten & Natur"},
 shopping:{pt:"Compras",en:"Shopping",fr:"Shopping",es:"Compras",de:"Einkaufen"},
 transport:{pt:"Transportes",en:"Transport",fr:"Transports",es:"Transporte",de:"Verkehr"},
 health:{pt:"Saúde e farmácias",en:"Health & pharmacies",fr:"Santé et pharmacies",es:"Salud y farmacias",de:"Gesundheit & Apotheken"},
};
export const recSchema=z.object({
 id:z.string().min(1).max(64),
 category:z.enum(REC_CATEGORIES),
 name:shortText(120).min(1,"Preenche o nome de cada recomendação."),
 note:translations.default(emptyTranslations()),
 address:shortText(200).default(""),
 mapsUrl:url.default(""),
 website:url.default(""),
 phone:shortText(40).default(""),
});
export type Recommendation=z.infer<typeof recSchema>;
export const cityRecsSchema=z.object({version:z.number().int().min(0),items:z.array(recSchema).max(200,"Máximo de 200 recomendações por localidade.")});
export type CityRecs=z.infer<typeof cityRecsSchema>;
/** Chave da localidade: "Fátima" e "fatima " dão a mesma lista. */
export const cityKey=(city:string)=>city.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
/** Link do Google Maps de uma recomendação (o indicado ou uma pesquisa pelo nome, morada e localidade). */
export const recMapUrl=(r:Pick<Recommendation,"name"|"address"|"mapsUrl">,city:string)=>r.mapsUrl||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.name,r.address,city].filter(Boolean).join(", "))}`;

/* ---------------------------------------------------------------- Textos fixos da página */

export const COMPLAINTS_URL="https://www.livroreclamacoes.pt/";
type Dict={[k:string]:string};
export const UI:Record<Lang,Dict>={
 pt:{guide:"Livro de informações",wifi:"Wi-Fi",network:"Rede",password:"Palavra-passe",copy:"Copiar",copied:"Copiado",checkin:"Check-in",checkout:"Check-out",quiet:"Silêncio",until:"Até",from:"A partir das",call:"Ligar",whatsapp:"WhatsApp",map:"Mapa",email:"Email",share:"Partilhar",linkCopied:"Link copiado.",photos:"Fotos",seeAll:"Ver todas as fotos",amenities:"Comodidades",recommendations:"Recomendações",recIntro:"Sugestões da nossa equipa em",openMap:"Mapa",website:"Website",emergency:"Emergências",emergencyIntro:"Em caso de emergência ligue 112 e indique a morada do alojamento.",e112:"Emergência (ambulância, polícia, bombeiros)",sns:"SNS 24 — linha de saúde (24 h)",host:"Contacto do alojamento",address:"Morada",legal:"Informação legal",license:"Registo",aima:"Por lei, os alojamentos turísticos comunicam às autoridades (AIMA) a estadia de hóspedes estrangeiros. Por isso pedimos um documento de identificação no check-in.",complaints:"Livro de Reclamações eletrónico",damage:"Tabela de quebras e danos",quietRule:"Horário de silêncio",contacts:"Contactos",back:"Voltar",language:"Língua",preview:"Pré-visualização: este livro ainda não está publicado e só é visível para a equipa.",notFound:"Este livro de informações não está disponível.",loading:"A carregar…",updated:"Atualizado a",photo:"Foto",of:"de",close:"Fechar",prev:"Anterior",next:"Seguinte",readMore:"Ler mais",readLess:"Mostrar menos",tagline:"Bem-vindo. Tudo o que precisa para a sua estadia."},
 en:{guide:"Guest information",wifi:"Wi-Fi",network:"Network",password:"Password",copy:"Copy",copied:"Copied",checkin:"Check-in",checkout:"Check-out",quiet:"Quiet hours",until:"Until",from:"From",call:"Call",whatsapp:"WhatsApp",map:"Map",email:"Email",share:"Share",linkCopied:"Link copied.",photos:"Photos",seeAll:"See all photos",amenities:"Amenities",recommendations:"Recommendations",recIntro:"Our team's tips in",openMap:"Map",website:"Website",emergency:"Emergencies",emergencyIntro:"In an emergency call 112 and give the property's address.",e112:"Emergency (ambulance, police, fire)",sns:"SNS 24 — health line (24 h)",host:"Property contact",address:"Address",legal:"Legal information",license:"Registration",aima:"By law, tourist accommodation must report the stay of foreign guests to the authorities (AIMA). That is why we ask for an ID document at check-in.",complaints:"Electronic complaints book",damage:"Breakage and damage charges",quietRule:"Quiet hours",contacts:"Contacts",back:"Back",language:"Language",preview:"Preview: this guide is not published yet and is only visible to staff.",notFound:"This guest information page is not available.",loading:"Loading…",updated:"Updated on",photo:"Photo",of:"of",close:"Close",prev:"Previous",next:"Next",readMore:"Read more",readLess:"Show less",tagline:"Welcome. Everything you need for your stay."},
 fr:{guide:"Livret d'accueil",wifi:"Wi-Fi",network:"Réseau",password:"Mot de passe",copy:"Copier",copied:"Copié",checkin:"Arrivée",checkout:"Départ",quiet:"Silence",until:"Jusqu'à",from:"À partir de",call:"Appeler",whatsapp:"WhatsApp",map:"Carte",email:"E-mail",share:"Partager",linkCopied:"Lien copié.",photos:"Photos",seeAll:"Voir toutes les photos",amenities:"Équipements",recommendations:"Recommandations",recIntro:"Les conseils de notre équipe à",openMap:"Carte",website:"Site web",emergency:"Urgences",emergencyIntro:"En cas d'urgence, appelez le 112 et indiquez l'adresse du logement.",e112:"Urgences (ambulance, police, pompiers)",sns:"SNS 24 — ligne santé (24 h)",host:"Contact du logement",address:"Adresse",legal:"Informations légales",license:"Enregistrement",aima:"Conformément à la loi, les hébergements touristiques déclarent aux autorités (AIMA) le séjour des clients étrangers. C'est pourquoi nous demandons une pièce d'identité à l'arrivée.",complaints:"Livre de réclamations électronique",damage:"Tarifs des casses et dommages",quietRule:"Heures de silence",contacts:"Contacts",back:"Retour",language:"Langue",preview:"Aperçu : ce livret n'est pas encore publié et n'est visible que par l'équipe.",notFound:"Ce livret d'accueil n'est pas disponible.",loading:"Chargement…",updated:"Mis à jour le",photo:"Photo",of:"sur",close:"Fermer",prev:"Précédente",next:"Suivante",readMore:"Lire la suite",readLess:"Réduire",tagline:"Bienvenue. Tout ce qu'il vous faut pour votre séjour."},
 es:{guide:"Guía del huésped",wifi:"Wi-Fi",network:"Red",password:"Contraseña",copy:"Copiar",copied:"Copiado",checkin:"Entrada",checkout:"Salida",quiet:"Silencio",until:"Hasta las",from:"Desde las",call:"Llamar",whatsapp:"WhatsApp",map:"Mapa",email:"Email",share:"Compartir",linkCopied:"Enlace copiado.",photos:"Fotos",seeAll:"Ver todas las fotos",amenities:"Servicios e instalaciones",recommendations:"Recomendaciones",recIntro:"Sugerencias de nuestro equipo en",openMap:"Mapa",website:"Web",emergency:"Emergencias",emergencyIntro:"En caso de emergencia llame al 112 e indique la dirección del alojamiento.",e112:"Emergencias (ambulancia, policía, bomberos)",sns:"SNS 24 — línea de salud (24 h)",host:"Contacto del alojamiento",address:"Dirección",legal:"Información legal",license:"Registro",aima:"Por ley, los alojamientos turísticos comunican a las autoridades (AIMA) la estancia de huéspedes extranjeros. Por eso pedimos un documento de identidad en el check-in.",complaints:"Libro de reclamaciones electrónico",damage:"Tabla de roturas y daños",quietRule:"Horario de silencio",contacts:"Contactos",back:"Volver",language:"Idioma",preview:"Vista previa: esta guía aún no está publicada y solo la ve el equipo.",notFound:"Esta guía del huésped no está disponible.",loading:"Cargando…",updated:"Actualizado el",photo:"Foto",of:"de",close:"Cerrar",prev:"Anterior",next:"Siguiente",readMore:"Leer más",readLess:"Mostrar menos",tagline:"Bienvenido. Todo lo que necesita para su estancia."},
 de:{guide:"Gästeinformation",wifi:"WLAN",network:"Netzwerk",password:"Passwort",copy:"Kopieren",copied:"Kopiert",checkin:"Check-in",checkout:"Check-out",quiet:"Ruhezeit",until:"Bis",from:"Ab",call:"Anrufen",whatsapp:"WhatsApp",map:"Karte",email:"E-Mail",share:"Teilen",linkCopied:"Link kopiert.",photos:"Fotos",seeAll:"Alle Fotos ansehen",amenities:"Ausstattung",recommendations:"Empfehlungen",recIntro:"Tipps unseres Teams in",openMap:"Karte",website:"Website",emergency:"Notfälle",emergencyIntro:"Rufen Sie im Notfall 112 an und nennen Sie die Adresse der Unterkunft.",e112:"Notruf (Krankenwagen, Polizei, Feuerwehr)",sns:"SNS 24 — Gesundheitstelefon (24 h)",host:"Kontakt der Unterkunft",address:"Adresse",legal:"Rechtliche Hinweise",license:"Registrierung",aima:"Gesetzlich müssen Ferienunterkünfte den Aufenthalt ausländischer Gäste den Behörden (AIMA) melden. Deshalb bitten wir beim Check-in um einen Ausweis.",complaints:"Elektronisches Beschwerdebuch",damage:"Preisliste für Bruch und Schäden",quietRule:"Ruhezeiten",contacts:"Kontakt",back:"Zurück",language:"Sprache",preview:"Vorschau: Diese Seite ist noch nicht veröffentlicht und nur für das Team sichtbar.",notFound:"Diese Gästeinformation ist nicht verfügbar.",loading:"Wird geladen…",updated:"Aktualisiert am",photo:"Foto",of:"von",close:"Schließen",prev:"Zurück",next:"Weiter",readMore:"Mehr lesen",readLess:"Weniger anzeigen",tagline:"Willkommen. Alles, was Sie für Ihren Aufenthalt brauchen."},
};
export const TEXT_TITLE:Record<GuestTextKey,Record<Lang,string>>={
 welcome:{pt:"Bem-vindo",en:"Welcome",fr:"Bienvenue",es:"Bienvenido",de:"Willkommen"},
 arrival:{pt:"Chegada e check-in",en:"Arrival & check-in",fr:"Arrivée",es:"Llegada y check-in",de:"Anreise & Check-in"},
 departure:{pt:"Saída e check-out",en:"Departure & check-out",fr:"Départ",es:"Salida y check-out",de:"Abreise & Check-out"},
 houseRules:{pt:"Regras da casa",en:"House rules",fr:"Règlement intérieur",es:"Normas de la casa",de:"Hausordnung"},
 services:{pt:"Serviços",en:"Services",fr:"Services",es:"Servicios",de:"Services"},
 appliances:{pt:"Equipamentos e instruções",en:"Appliances & instructions",fr:"Équipements et modes d'emploi",es:"Equipamiento e instrucciones",de:"Geräte & Anleitungen"},
 waste:{pt:"Lixo e reciclagem",en:"Rubbish & recycling",fr:"Déchets et recyclage",es:"Basura y reciclaje",de:"Müll & Recycling"},
 parking:{pt:"Estacionamento e acessos",en:"Parking & getting here",fr:"Stationnement et accès",es:"Aparcamiento y acceso",de:"Parken & Anreise"},
 safety:{pt:"Segurança",en:"Safety",fr:"Sécurité",es:"Seguridad",de:"Sicherheit"},
};
export const AMENITY_GROUP_LABEL:Record<string,Record<Lang,string>>={
 "Conforto e equipamento":{pt:"Conforto e equipamento",en:"Comfort & equipment",fr:"Confort et équipement",es:"Confort y equipamiento",de:"Komfort & Ausstattung"},
 "Casa de banho e cozinha":{pt:"Casa de banho e cozinha",en:"Bathroom & kitchen",fr:"Salle de bain et cuisine",es:"Baño y cocina",de:"Bad & Küche"},
 "Serviços e áreas comuns":{pt:"Serviços e áreas comuns",en:"Services & common areas",fr:"Services et espaces communs",es:"Servicios y zonas comunes",de:"Services & Gemeinschaftsbereiche"},
 "Lazer e exterior":{pt:"Lazer e exterior",en:"Leisure & outdoors",fr:"Loisirs et extérieur",es:"Ocio y exterior",de:"Freizeit & Außenbereich"},
 "Acessibilidade e famílias":{pt:"Acessibilidade e famílias",en:"Accessibility & families",fr:"Accessibilité et familles",es:"Accesibilidad y familias",de:"Barrierefreiheit & Familien"},
 "Personalizadas":{pt:"Outros",en:"Other",fr:"Autres",es:"Otros",de:"Sonstiges"},
};
/** Comodidades do catálogo padrão. As personalizadas aparecem como foram escritas. */
const A=(en:string,fr:string,es:string,de:string)=>({en,fr,es,de});
export const AMENITY_LABEL:Record<string,{en:string,fr:string,es:string,de:string}>={
 "Wi-Fi":A("Wi-Fi","Wi-Fi","Wi-Fi","WLAN"),"Ar condicionado":A("Air conditioning","Climatisation","Aire acondicionado","Klimaanlage"),"Aquecimento":A("Heating","Chauffage","Calefacción","Heizung"),"Televisão":A("TV","Télévision","Televisión","Fernseher"),"Cofre":A("Safe","Coffre-fort","Caja fuerte","Safe"),"Minibar":A("Minibar","Minibar","Minibar","Minibar"),"Secretária":A("Desk","Bureau","Escritorio","Schreibtisch"),"Varanda ou terraço":A("Balcony or terrace","Balcon ou terrasse","Balcón o terraza","Balkon oder Terrasse"),"Roupeiro":A("Wardrobe","Armoire","Armario","Kleiderschrank"),
 "Casa de banho privativa":A("Private bathroom","Salle de bain privée","Baño privado","Eigenes Bad"),"Secador de cabelo":A("Hairdryer","Sèche-cheveux","Secador de pelo","Haartrockner"),"Produtos de higiene":A("Toiletries","Articles de toilette","Artículos de aseo","Pflegeprodukte"),"Toalhas":A("Towels","Serviettes","Toallas","Handtücher"),"Kitchenette":A("Kitchenette","Kitchenette","Cocina americana","Kochnische"),"Cozinha equipada":A("Equipped kitchen","Cuisine équipée","Cocina equipada","Ausgestattete Küche"),"Frigorífico":A("Fridge","Réfrigérateur","Nevera","Kühlschrank"),"Micro-ondas":A("Microwave","Micro-ondes","Microondas","Mikrowelle"),"Máquina de café":A("Coffee machine","Machine à café","Cafetera","Kaffeemaschine"),
 "Receção 24 horas":A("24-hour reception","Réception 24 h/24","Recepción 24 horas","24-Stunden-Rezeption"),"Check-in autónomo":A("Self check-in","Arrivée autonome","Check-in autónomo","Self-Check-in"),"Elevador":A("Lift","Ascenseur","Ascensor","Aufzug"),"Depósito de bagagens":A("Luggage storage","Bagagerie","Consigna de equipaje","Gepäckaufbewahrung"),"Pequeno-almoço":A("Breakfast","Petit-déjeuner","Desayuno","Frühstück"),"Restaurante":A("Restaurant","Restaurant","Restaurante","Restaurant"),"Bar":A("Bar","Bar","Bar","Bar"),"Lavandaria":A("Laundry","Laverie","Lavandería","Wäscherei"),"Transfer":A("Transfer","Navette","Traslado","Transfer"),
 "Piscina exterior":A("Outdoor pool","Piscine extérieure","Piscina exterior","Außenpool"),"Piscina interior":A("Indoor pool","Piscine intérieure","Piscina interior","Hallenbad"),"Piscina infantil":A("Children's pool","Pataugeoire","Piscina infantil","Kinderbecken"),"Jardim":A("Garden","Jardin","Jardín","Garten"),"Ginásio":A("Gym","Salle de sport","Gimnasio","Fitnessraum"),"Spa":A("Spa","Spa","Spa","Spa"),"Parque infantil":A("Playground","Aire de jeux","Parque infantil","Spielplatz"),"Estacionamento privado":A("Private parking","Parking privé","Aparcamiento privado","Privatparkplatz"),"Estacionamento público":A("Public parking","Parking public","Aparcamiento público","Öffentlicher Parkplatz"),
 "Acesso sem degraus":A("Step-free access","Accès de plain-pied","Acceso sin escalones","Stufenloser Zugang"),"Quartos adaptados":A("Adapted rooms","Chambres adaptées","Habitaciones adaptadas","Barrierefreie Zimmer"),"Casa de banho adaptada":A("Adapted bathroom","Salle de bain adaptée","Baño adaptado","Barrierefreies Bad"),"Berço":A("Cot","Lit bébé","Cuna","Babybett"),"Cama extra":A("Extra bed","Lit d'appoint","Cama supletoria","Zustellbett"),"Cadeira de bebé":A("High chair","Chaise haute","Trona","Hochstuhl"),"Animais de estimação permitidos":A("Pets allowed","Animaux acceptés","Se admiten mascotas","Haustiere erlaubt"),
};
export const amenityLabel=(label:string,lang:Lang)=>lang==="pt"?label:AMENITY_LABEL[label]?.[lang]||label;
