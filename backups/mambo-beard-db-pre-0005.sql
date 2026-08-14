PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    , product_type TEXT NOT NULL DEFAULT 'variant', variation_type TEXT NOT NULL DEFAULT 'none');
INSERT INTO "products" ("id","name","slug","description","price","category","featured","active","created_at","updated_at","product_type","variation_type") VALUES('prod-1785765269477','ben','ben','cbjcenc',23,'Care',0,0,'2026-08-03T14:43:24.808Z','2026-08-06T02:11:44.011Z','variant','none');
INSERT INTO "products" ("id","name","slug","description","price","category","featured","active","created_at","updated_at","product_type","variation_type") VALUES('prod-1785847630086','TS-01','ts-01','Crafted from premium heavyweight cotton with an oversized, structured drop, this essential wardrobe staple delivers a relaxed aesthetic designed to maintain its form and soft hand-feel wear after wear.',2000,'tshirt',0,1,'2026-08-05T20:25:55.160Z','2026-08-05T20:25:55.160Z','variant','none');
INSERT INTO "products" ("id","name","slug","description","price","category","featured","active","created_at","updated_at","product_type","variation_type") VALUES('prod-1785962422713','TS-03','ts-03','f',2000,'tshirt',0,1,'2026-08-05T20:40:47.960Z','2026-08-05T20:40:47.960Z','variant','none');
INSERT INTO "products" ("id","name","slug","description","price","category","featured","active","created_at","updated_at","product_type","variation_type") VALUES('prod-1785982505400','TB-01','tb-01','hj',1500,'bag',0,1,'2026-08-06T02:15:30.427Z','2026-08-06T02:15:30.427Z','variant','none');
INSERT INTO "products" ("id","name","slug","description","price","category","featured","active","created_at","updated_at","product_type","variation_type") VALUES('prod-1785982559960','TB-02','tb-02','h',1500,'Care',0,0,'2026-08-06T02:16:24.691Z','2026-08-06T02:35:17.951Z','variant','none');
INSERT INTO "products" ("id","name","slug","description","price","category","featured","active","created_at","updated_at","product_type","variation_type") VALUES('prod-1785982627866','TB-03','tb-03','hj',1500,'bag',0,1,'2026-08-06T02:17:32.615Z','2026-08-06T02:17:32.615Z','variant','none');
INSERT INTO "products" ("id","name","slug","description","price","category","featured","active","created_at","updated_at","product_type","variation_type") VALUES('prod-1785982890316','MC-02','mc-02','g',1500,'hats',0,1,'2026-08-06T02:21:55.308Z','2026-08-06T02:21:55.308Z','variant','none');
INSERT INTO "products" ("id","name","slug","description","price","category","featured","active","created_at","updated_at","product_type","variation_type") VALUES('prod-1785982809703','MC-01','mc-01','gh',1500,'hat',0,1,'2026-08-06T02:30:13.883Z','2026-08-06T02:30:13.883Z','variant','none');
INSERT INTO "products" ("id","name","slug","description","price","category","featured","active","created_at","updated_at","product_type","variation_type") VALUES('prod-1785962224002','TS-02','ts-02','w',2000,'tshirt',0,1,'2026-08-06T02:36:27.724Z','2026-08-06T02:36:27.724Z','variant','none');
INSERT INTO "products" ("id","name","slug","description","price","category","featured","active","created_at","updated_at","product_type","variation_type") VALUES('prod-1785962631271','TS-4','ts-4','f',2000,'tshirt',0,1,'2026-08-06T02:37:43.014Z','2026-08-06T02:37:43.014Z','variant','none');
CREATE TABLE product_colors (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      hex TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785765011649-0','prod-1785765269477','black','#17191c',1,'2026-08-03T14:43:24.808Z','2026-08-03T14:43:24.808Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785847141701-0','prod-1785847630086','black','#000000',1,'2026-08-05T20:25:55.160Z','2026-08-05T20:25:55.160Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785847243349-1','prod-1785847630086','pink','#ffc0cb',1,'2026-08-05T20:25:55.160Z','2026-08-05T20:25:55.160Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785847490006-2','prod-1785847630086','burgandy','#800020',3,'2026-08-05T20:25:55.160Z','2026-08-05T20:25:55.160Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785962256709-0','prod-1785962422713','white','#dfe0e1',1,'2026-08-05T20:40:47.960Z','2026-08-05T20:40:47.960Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785962348075-1','prod-1785962422713','black','#050505',2,'2026-08-05T20:40:47.960Z','2026-08-05T20:40:47.960Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785982354423-0','prod-1785982505400','white','#c1c5cd',1,'2026-08-06T02:15:30.427Z','2026-08-06T02:15:30.427Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785982524207-0','prod-1785982559960','white','#8d9096',1,'2026-08-06T02:16:24.691Z','2026-08-06T02:16:24.691Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785982584044-0','prod-1785982627866','green','#47810e',1,'2026-08-06T02:17:32.615Z','2026-08-06T02:17:32.615Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785982857367-0','prod-1785982890316','navy blue','#151e32',1,'2026-08-06T02:21:55.308Z','2026-08-06T02:21:55.308Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785982771685-0','prod-1785982809703','black','#0f0f0f',1,'2026-08-06T02:30:13.883Z','2026-08-06T02:30:13.883Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785961930089-0','prod-1785962224002','black','#0c0c0e',3,'2026-08-06T02:36:27.724Z','2026-08-06T02:36:27.724Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785961992805-1','prod-1785962224002','white','#b7bbc3',2,'2026-08-06T02:36:27.724Z','2026-08-06T02:36:27.724Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785961994050-2','prod-1785962224002','pink','#ff69b4',1,'2026-08-06T02:36:27.724Z','2026-08-06T02:36:27.724Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785962457811-0','prod-1785962631271','white','#ffffff',1,'2026-08-06T02:37:43.014Z','2026-08-06T02:37:43.014Z');
INSERT INTO "product_colors" ("id","product_id","name","hex","sort_order","created_at","updated_at") VALUES('color-1785962526319-1','prod-1785962631271','pinl','#ff69b4',2,'2026-08-06T02:37:43.014Z','2026-08-06T02:37:43.014Z');
CREATE TABLE product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      color_id TEXT NOT NULL,
      path TEXT NOT NULL,
      type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      uploaded_at TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (color_id) REFERENCES product_colors(id) ON DELETE CASCADE
    );
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785765011649-0-1785768182716-0-uploaded','prod-1785765269477','color-1785765011649-0','products/ben/black/back/1785768198116-fxgpdr.jpg','back','images (7).jpg',7740,'2026-08-03T14:43:03.054Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785847141701-0-1785961289025-uploaded','prod-1785847630086','color-1785847141701-0','products/ts-01/black/front/1785961313631-3ab3ct.webp','front','Artboard 6.webp',21390,'2026-08-05T20:21:29.605Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785847141701-0-1785961430098-0-uploaded','prod-1785847630086','color-1785847141701-0','products/ts-01/black/back/1785961454814-ru2ret.webp','back','Artboard 12.webp',14618,'2026-08-05T20:23:50.784Z',0,2);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785847243349-1-1785961249651-uploaded','prod-1785847630086','color-1785847243349-1','products/ts-01/pink/front/1785961274267-r7ibyo.webp','front','Artboard 23.webp',28776,'2026-08-05T20:20:50.264Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785847243349-1-1785961261914-uploaded','prod-1785847630086','color-1785847243349-1','products/ts-01/pink/back/1785961286509-8bu1hm.webp','back','Artboard 22.webp',20418,'2026-08-05T20:21:02.542Z',0,2);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785847490006-2-1785961513100-uploaded','prod-1785847630086','color-1785847490006-2','products/ts-01/burgandy/back/1785961537706-no2c8a.webp','back','Artboard 16.webp',16710,'2026-08-05T20:25:14.040Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785847490006-2-1785961524070-uploaded','prod-1785847630086','color-1785847490006-2','products/ts-01/burgandy/front/1785961548673-7m4i9v.webp','front','Artboard 15.webp',25096,'2026-08-05T20:25:24.905Z',0,2);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785962256709-0-1785962302885-0-uploaded','prod-1785962422713','color-1785962256709-0','products/ts-03/white/front/1785962327741-xdpapb.webp','front','Artboard 21.webp',27776,'2026-08-05T20:38:24.165Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785962256709-0-1785962308052-0-uploaded','prod-1785962422713','color-1785962256709-0','products/ts-03/white/back/1785962332636-4jfwq5.webp','back','Artboard 26.webp',20978,'2026-08-05T20:38:29.058Z',0,2);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785962348075-1-1785962381210-0-uploaded','prod-1785962422713','color-1785962348075-1','products/ts-03/black/front/1785962406168-hr5j00.webp','front','Artboard 14.webp',25582,'2026-08-05T20:39:42.544Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785962348075-1-1785962390814-0-uploaded','prod-1785962422713','color-1785962348075-1','products/ts-03/black/back/1785962415413-9ur389.webp','back','Artboard 12.webp',14618,'2026-08-05T20:39:51.457Z',0,2);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785982354423-0-1785982484744-0-uploaded','prod-1785982505400','color-1785982354423-0','products/tb-01/white/front/1785982509381-2547fg.webp','front','Artboard 4.webp',43868,'2026-08-06T02:14:45.479Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785982524207-0-1785982546649-0-uploaded','prod-1785982559960','color-1785982524207-0','products/tb-02/white/front/1785982571339-ya08p8.webp','front','Artboard 3.webp',46498,'2026-08-06T02:15:47.388Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785982584044-0-1785982618213-0-uploaded','prod-1785982627866','color-1785982584044-0','products/tb-03/green/front/1785982643060-hpqrqy.webp','front','Artboard 28.webp',44388,'2026-08-06T02:16:59.103Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785982857367-0-1785982880854-0-uploaded','prod-1785982890316','color-1785982857367-0','products/mc-02/navy-blue/front/1785982905466-nom1o8.webp','front','Artboard 27.webp',21818,'2026-08-06T02:21:21.906Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785982771685-0-1785983381094-uploaded','prod-1785982809703','color-1785982771685-0','products/mc-01/black/front/1785983405586-9r4m1y.webp','front','Artboard 1.webp',17840,'2026-08-06T02:29:41.732Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785961930089-0-1785961970809-0-uploaded','prod-1785962224002','color-1785961930089-0','products/ts-02/black/front/1785961995844-9zidjj.webp','front','Artboard 13.webp',25926,'2026-08-05T20:32:52.228Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785961930089-0-1785961986177-0-uploaded','prod-1785962224002','color-1785961930089-0','products/ts-02/black/back/1785962010781-qmct8e.webp','back','Artboard 12.webp',14618,'2026-08-05T20:33:06.813Z',0,2);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785961992805-1-1785962138906-0-uploaded','prod-1785962224002','color-1785961992805-1','products/ts-02/white/front/1785962163636-dmp5hj.webp','front','Artboard 25.webp',31976,'2026-08-05T20:35:39.642Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785961992805-1-1785962145090-0-uploaded','prod-1785962224002','color-1785961992805-1','products/ts-02/white/back/1785962169686-0e5hdc.webp','back','Artboard 26.webp',20978,'2026-08-05T20:35:45.796Z',0,2);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785961994050-2-1785962154576-0-uploaded','prod-1785962224002','color-1785961994050-2','products/ts-02/pink/front/1785962179191-h4rygo.webp','front','Artboard 9.webp',30628,'2026-08-05T20:35:55.165Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785961994050-2-1785962168010-0-uploaded','prod-1785962224002','color-1785961994050-2','products/ts-02/pink/back/1785962192605-0dcdxn.webp','back','Artboard 22.webp',20418,'2026-08-05T20:36:08.694Z',0,2);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785962457811-0-1785962507051-0-uploaded','prod-1785962631271','color-1785962457811-0','products/ts-4/white/front/1785962531754-oo0i3l.webp','front','Artboard 11.webp',22742,'2026-08-05T20:41:48.106Z',0,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785962457811-0-1785983564970-uploaded','prod-1785962631271','color-1785962457811-0','products/ts-4/white/back/1785983589600-2d1b5p.webp','back','Artboard 10.webp',43936,'2026-08-06T02:32:45.745Z',1,2);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785962526319-1-1785962596818-0-uploaded','prod-1785962631271','color-1785962526319-1','products/ts-4/color-2/front/1785962621543-rtmw1v.webp','front','Artboard 19.webp',18714,'2026-08-05T20:43:17.908Z',1,1);
INSERT INTO "product_images" ("id","product_id","color_id","path","type","file_name","size","uploaded_at","is_primary","sort_order") VALUES('color-1785962526319-1-1785962601387-0-uploaded','prod-1785962631271','color-1785962526319-1','products/ts-4/color-2/back/1785962626012-pdhy9y.webp','back','Artboard 20.webp',38122,'2026-08-05T20:43:22.365Z',0,2);
CREATE TABLE product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      color_id TEXT NOT NULL,
      size TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (color_id) REFERENCES product_colors(id) ON DELETE CASCADE
    );
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785765011649-0-L','prod-1785765269477','color-1785765011649-0','L',0);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785765011649-0-M','prod-1785765269477','color-1785765011649-0','M',2);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785765011649-0-S','prod-1785765269477','color-1785765011649-0','S',4);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785765011649-0-XL','prod-1785765269477','color-1785765011649-0','XL',0);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785765011649-0-XS','prod-1785765269477','color-1785765011649-0','XS',2);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847141701-0-L','prod-1785847630086','color-1785847141701-0','L',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847141701-0-M','prod-1785847630086','color-1785847141701-0','M',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847141701-0-S','prod-1785847630086','color-1785847141701-0','S',48);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847141701-0-XL','prod-1785847630086','color-1785847141701-0','XL',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847141701-0-XS','prod-1785847630086','color-1785847141701-0','XS',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847243349-1-L','prod-1785847630086','color-1785847243349-1','L',49);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847243349-1-M','prod-1785847630086','color-1785847243349-1','M',48);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847243349-1-S','prod-1785847630086','color-1785847243349-1','S',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847243349-1-XL','prod-1785847630086','color-1785847243349-1','XL',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847243349-1-XS','prod-1785847630086','color-1785847243349-1','XS',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847490006-2-L','prod-1785847630086','color-1785847490006-2','L',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847490006-2-M','prod-1785847630086','color-1785847490006-2','M',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847490006-2-S','prod-1785847630086','color-1785847490006-2','S',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847490006-2-XL','prod-1785847630086','color-1785847490006-2','XL',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785847490006-2-XS','prod-1785847630086','color-1785847490006-2','XS',50);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962256709-0-XS','prod-1785962422713','color-1785962256709-0','XS',65);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962256709-0-S','prod-1785962422713','color-1785962256709-0','S',56);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962256709-0-M','prod-1785962422713','color-1785962256709-0','M',56);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962256709-0-L','prod-1785962422713','color-1785962256709-0','L',656);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962256709-0-XL','prod-1785962422713','color-1785962256709-0','XL',65);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962348075-1-XS','prod-1785962422713','color-1785962348075-1','XS',65);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962348075-1-S','prod-1785962422713','color-1785962348075-1','S',65);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962348075-1-M','prod-1785962422713','color-1785962348075-1','M',656);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962348075-1-L','prod-1785962422713','color-1785962348075-1','L',656);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962348075-1-XL','prod-1785962422713','color-1785962348075-1','XL',656);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982354423-0-XS','prod-1785982505400','color-1785982354423-0','XS',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982354423-0-S','prod-1785982505400','color-1785982354423-0','S',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982354423-0-M','prod-1785982505400','color-1785982354423-0','M',55);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982354423-0-L','prod-1785982505400','color-1785982354423-0','L',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982354423-0-XL','prod-1785982505400','color-1785982354423-0','XL',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982524207-0-XS','prod-1785982559960','color-1785982524207-0','XS',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982524207-0-S','prod-1785982559960','color-1785982524207-0','S',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982524207-0-M','prod-1785982559960','color-1785982524207-0','M',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982524207-0-L','prod-1785982559960','color-1785982524207-0','L',2);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982524207-0-XL','prod-1785982559960','color-1785982524207-0','XL',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982584044-0-XS','prod-1785982627866','color-1785982584044-0','XS',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982584044-0-S','prod-1785982627866','color-1785982584044-0','S',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982584044-0-M','prod-1785982627866','color-1785982584044-0','M',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982584044-0-L','prod-1785982627866','color-1785982584044-0','L',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982584044-0-XL','prod-1785982627866','color-1785982584044-0','XL',5);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982857367-0-XS','prod-1785982890316','color-1785982857367-0','XS',44);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982857367-0-S','prod-1785982890316','color-1785982857367-0','S',44);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982857367-0-M','prod-1785982890316','color-1785982857367-0','M',44);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982857367-0-L','prod-1785982890316','color-1785982857367-0','L',44);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982857367-0-XL','prod-1785982890316','color-1785982857367-0','XL',44);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982771685-0-XS','prod-1785982809703','color-1785982771685-0','XS',55);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982771685-0-S','prod-1785982809703','color-1785982771685-0','S',55);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982771685-0-M','prod-1785982809703','color-1785982771685-0','M',55);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982771685-0-L','prod-1785982809703','color-1785982771685-0','L',55);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785982771685-0-XL','prod-1785982809703','color-1785982771685-0','XL',55);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961930089-0-L','prod-1785962224002','color-1785961930089-0','L',454);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961930089-0-M','prod-1785962224002','color-1785961930089-0','M',23);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961930089-0-S','prod-1785962224002','color-1785961930089-0','S',45);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961930089-0-XL','prod-1785962224002','color-1785961930089-0','XL',23);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961930089-0-XS','prod-1785962224002','color-1785961930089-0','XS',24);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961992805-1-L','prod-1785962224002','color-1785961992805-1','L',453);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961992805-1-M','prod-1785962224002','color-1785961992805-1','M',343);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961992805-1-S','prod-1785962224002','color-1785961992805-1','S',45);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961992805-1-XL','prod-1785962224002','color-1785961992805-1','XL',4532);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961992805-1-XS','prod-1785962224002','color-1785961992805-1','XS',345);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961994050-2-L','prod-1785962224002','color-1785961994050-2','L',325);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961994050-2-M','prod-1785962224002','color-1785961994050-2','M',345);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961994050-2-S','prod-1785962224002','color-1785961994050-2','S',345);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961994050-2-XL','prod-1785962224002','color-1785961994050-2','XL',353);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785961994050-2-XS','prod-1785962224002','color-1785961994050-2','XS',453);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962457811-0-L','prod-1785962631271','color-1785962457811-0','L',55);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962457811-0-M','prod-1785962631271','color-1785962457811-0','M',54);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962457811-0-S','prod-1785962631271','color-1785962457811-0','S',545);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962457811-0-XL','prod-1785962631271','color-1785962457811-0','XL',55);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962457811-0-XS','prod-1785962631271','color-1785962457811-0','XS',54);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962526319-1-L','prod-1785962631271','color-1785962526319-1','L',55);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962526319-1-M','prod-1785962631271','color-1785962526319-1','M',554);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962526319-1-S','prod-1785962631271','color-1785962526319-1','S',55);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962526319-1-XL','prod-1785962631271','color-1785962526319-1','XL',545);
INSERT INTO "product_variants" ("id","product_id","color_id","size","stock") VALUES('color-1785962526319-1-XS','prod-1785962631271','color-1785962526319-1','XS',55);
CREATE TABLE sizes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
INSERT INTO "sizes" ("id","name") VALUES('size-xs','XS');
INSERT INTO "sizes" ("id","name") VALUES('size-s','S');
INSERT INTO "sizes" ("id","name") VALUES('size-m','M');
INSERT INTO "sizes" ("id","name") VALUES('size-l','L');
INSERT INTO "sizes" ("id","name") VALUES('size-xl','XL');
INSERT INTO "sizes" ("id","name") VALUES('size-xxl','XXL');
CREATE TABLE inventory (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    color_id TEXT NOT NULL,
    size_id TEXT NOT NULL,
    stock INTEGER NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(color_id) REFERENCES product_colors(id) ON DELETE CASCADE,
    FOREIGN KEY(size_id) REFERENCES sizes(id) ON DELETE CASCADE
  );
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847141701-0__size-l','prod-1785847630086','color-1785847141701-0','size-l',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847141701-0__size-m','prod-1785847630086','color-1785847141701-0','size-m',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847141701-0__size-s','prod-1785847630086','color-1785847141701-0','size-s',48);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847141701-0__size-xl','prod-1785847630086','color-1785847141701-0','size-xl',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847141701-0__size-xs','prod-1785847630086','color-1785847141701-0','size-xs',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847243349-1__size-l','prod-1785847630086','color-1785847243349-1','size-l',49);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847243349-1__size-m','prod-1785847630086','color-1785847243349-1','size-m',48);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847243349-1__size-s','prod-1785847630086','color-1785847243349-1','size-s',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847243349-1__size-xl','prod-1785847630086','color-1785847243349-1','size-xl',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847243349-1__size-xs','prod-1785847630086','color-1785847243349-1','size-xs',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847490006-2__size-l','prod-1785847630086','color-1785847490006-2','size-l',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847490006-2__size-m','prod-1785847630086','color-1785847490006-2','size-m',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847490006-2__size-s','prod-1785847630086','color-1785847490006-2','size-s',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847490006-2__size-xl','prod-1785847630086','color-1785847490006-2','size-xl',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785847490006-2__size-xs','prod-1785847630086','color-1785847490006-2','size-xs',50);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962256709-0__size-xs','prod-1785962422713','color-1785962256709-0','size-xs',65);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962256709-0__size-s','prod-1785962422713','color-1785962256709-0','size-s',56);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962256709-0__size-m','prod-1785962422713','color-1785962256709-0','size-m',56);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962256709-0__size-l','prod-1785962422713','color-1785962256709-0','size-l',656);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962256709-0__size-xl','prod-1785962422713','color-1785962256709-0','size-xl',65);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962348075-1__size-xs','prod-1785962422713','color-1785962348075-1','size-xs',65);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962348075-1__size-s','prod-1785962422713','color-1785962348075-1','size-s',65);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962348075-1__size-m','prod-1785962422713','color-1785962348075-1','size-m',656);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962348075-1__size-l','prod-1785962422713','color-1785962348075-1','size-l',656);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962348075-1__size-xl','prod-1785962422713','color-1785962348075-1','size-xl',656);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982354423-0__size-xs','prod-1785982505400','color-1785982354423-0','size-xs',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982354423-0__size-s','prod-1785982505400','color-1785982354423-0','size-s',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982354423-0__size-m','prod-1785982505400','color-1785982354423-0','size-m',55);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982354423-0__size-l','prod-1785982505400','color-1785982354423-0','size-l',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982354423-0__size-xl','prod-1785982505400','color-1785982354423-0','size-xl',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982524207-0__size-xs','prod-1785982559960','color-1785982524207-0','size-xs',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982524207-0__size-s','prod-1785982559960','color-1785982524207-0','size-s',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982524207-0__size-m','prod-1785982559960','color-1785982524207-0','size-m',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982524207-0__size-l','prod-1785982559960','color-1785982524207-0','size-l',2);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982524207-0__size-xl','prod-1785982559960','color-1785982524207-0','size-xl',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982584044-0__size-xs','prod-1785982627866','color-1785982584044-0','size-xs',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982584044-0__size-s','prod-1785982627866','color-1785982584044-0','size-s',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982584044-0__size-m','prod-1785982627866','color-1785982584044-0','size-m',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982584044-0__size-l','prod-1785982627866','color-1785982584044-0','size-l',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982584044-0__size-xl','prod-1785982627866','color-1785982584044-0','size-xl',5);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982857367-0__size-xs','prod-1785982890316','color-1785982857367-0','size-xs',44);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982857367-0__size-s','prod-1785982890316','color-1785982857367-0','size-s',44);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982857367-0__size-m','prod-1785982890316','color-1785982857367-0','size-m',44);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982857367-0__size-l','prod-1785982890316','color-1785982857367-0','size-l',44);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982857367-0__size-xl','prod-1785982890316','color-1785982857367-0','size-xl',44);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982771685-0__size-xs','prod-1785982809703','color-1785982771685-0','size-xs',55);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982771685-0__size-s','prod-1785982809703','color-1785982771685-0','size-s',55);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982771685-0__size-m','prod-1785982809703','color-1785982771685-0','size-m',55);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982771685-0__size-l','prod-1785982809703','color-1785982771685-0','size-l',55);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785982771685-0__size-xl','prod-1785982809703','color-1785982771685-0','size-xl',55);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961930089-0__size-l','prod-1785962224002','color-1785961930089-0','size-l',454);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961930089-0__size-m','prod-1785962224002','color-1785961930089-0','size-m',23);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961930089-0__size-s','prod-1785962224002','color-1785961930089-0','size-s',45);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961930089-0__size-xl','prod-1785962224002','color-1785961930089-0','size-xl',23);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961930089-0__size-xs','prod-1785962224002','color-1785961930089-0','size-xs',24);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961992805-1__size-l','prod-1785962224002','color-1785961992805-1','size-l',453);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961992805-1__size-m','prod-1785962224002','color-1785961992805-1','size-m',343);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961992805-1__size-s','prod-1785962224002','color-1785961992805-1','size-s',45);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961992805-1__size-xl','prod-1785962224002','color-1785961992805-1','size-xl',4532);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961992805-1__size-xs','prod-1785962224002','color-1785961992805-1','size-xs',345);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961994050-2__size-l','prod-1785962224002','color-1785961994050-2','size-l',325);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961994050-2__size-m','prod-1785962224002','color-1785961994050-2','size-m',345);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961994050-2__size-s','prod-1785962224002','color-1785961994050-2','size-s',345);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961994050-2__size-xl','prod-1785962224002','color-1785961994050-2','size-xl',353);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785961994050-2__size-xs','prod-1785962224002','color-1785961994050-2','size-xs',453);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962457811-0__size-l','prod-1785962631271','color-1785962457811-0','size-l',55);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962457811-0__size-m','prod-1785962631271','color-1785962457811-0','size-m',54);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962457811-0__size-s','prod-1785962631271','color-1785962457811-0','size-s',545);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962457811-0__size-xl','prod-1785962631271','color-1785962457811-0','size-xl',55);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962457811-0__size-xs','prod-1785962631271','color-1785962457811-0','size-xs',54);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962526319-1__size-l','prod-1785962631271','color-1785962526319-1','size-l',55);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962526319-1__size-m','prod-1785962631271','color-1785962526319-1','size-m',554);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962526319-1__size-s','prod-1785962631271','color-1785962526319-1','size-s',55);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962526319-1__size-xl','prod-1785962631271','color-1785962526319-1','size-xl',545);
INSERT INTO "inventory" ("id","product_id","color_id","size_id","stock") VALUES('color-1785962526319-1__size-xs','prod-1785962631271','color-1785962526319-1','size-xs',55);
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    customer_name TEXT,
    phone TEXT,
    email TEXT,
    location TEXT,
    delivery_fee INTEGER,
    subtotal INTEGER,
    total INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
INSERT INTO "orders" ("id","order_number","customer_name","phone","email","location","delivery_fee","subtotal","total","status","created_at") VALUES('000b96e5-8b51-4ef6-95c2-aca6f97c0d85','MB-20260805-7491','benson Morrice','0117954929','benson7191@gmail.com','Nairobi CBD',200,2000,2200,'pending','2026-08-05 02:37:03');
INSERT INTO "orders" ("id","order_number","customer_name","phone","email","location","delivery_fee","subtotal","total","status","created_at") VALUES('60ef66ca-1bbc-4dfe-b126-036b42583ea3','MB-20260805-7532','benson Morrice','0117954929','benson7191@gmail.com','Nairobi CBD',200,2000,2200,'pending','2026-08-05 02:37:03');
INSERT INTO "orders" ("id","order_number","customer_name","phone","email","location","delivery_fee","subtotal","total","status","created_at") VALUES('62241fea-aa88-4216-a20e-127db48e96fa','MB-20260805-0003','Morrice','0712700573','severinobenson@gmail.com','Nairobi CBD',200,2000,2200,'pending','2026-08-05 04:40:25');
INSERT INTO "orders" ("id","order_number","customer_name","phone","email","location","delivery_fee","subtotal","total","status","created_at") VALUES('a03a39d7-3d95-463f-984f-0066df2bbf11','MB-20260805-0004','Morrice','0712700573','severinobenson@gmail.com','Kilimani',150,2000,2150,'pending','2026-08-05 04:43:27');
INSERT INTO "orders" ("id","order_number","customer_name","phone","email","location","delivery_fee","subtotal","total","status","created_at") VALUES('78a7a753-3811-4f09-8494-9977e651b8fa','MB-20260805-0005','Morrice','0712700573','severinobenson@gmail.com','Nairobi CBD',200,2000,2200,'confirmed','2026-08-05 05:10:51');
INSERT INTO "orders" ("id","order_number","customer_name","phone","email","location","delivery_fee","subtotal","total","status","created_at") VALUES('b17c718a-3d6d-42e0-9b29-be8b7d019433','MB-20260805-0006','Morrice','0712700573','severinobenson@gmail.com','Westlands',150,23,173,'pending','2026-08-05 12:55:02');
CREATE TABLE order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    color_id TEXT NOT NULL,
    size TEXT,
    size_id TEXT,
    quantity INTEGER NOT NULL,
    price INTEGER NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(color_id) REFERENCES product_colors(id) ON DELETE CASCADE,
    FOREIGN KEY(size_id) REFERENCES sizes(id) ON DELETE CASCADE
  );
INSERT INTO "order_items" ("id","order_id","product_id","color_id","size","size_id","quantity","price") VALUES('1ffe6f4c-de53-49c2-90b8-ae817ce11c0e','b17c718a-3d6d-42e0-9b29-be8b7d019433','prod-1785765269477','color-1785765011649-0','M',NULL,1,23);
CREATE TABLE admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    name TEXT,
    email TEXT,
    location TEXT,
    total_orders INTEGER NOT NULL DEFAULT 0,
    lifetime_spend INTEGER NOT NULL DEFAULT 0,
    last_order_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
INSERT INTO "customers" ("id","phone","name","email","location","total_orders","lifetime_spend","last_order_at","created_at","updated_at") VALUES('d7f89975-e127-4090-ad65-166acee0a570','0712700573','Morrice','severinobenson@gmail.com','Westlands',4,6723,'2026-08-05 12:55:02','2026-08-05 04:40:25','2026-08-05 12:55:02');
CREATE TABLE subscribers (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
INSERT INTO "subscribers" ("id","phone","created_at") VALUES('225157b1-6a9e-47de-9a11-47d23da3a59f','+254712700573','2026-08-07 09:09:11');
INSERT INTO "subscribers" ("id","phone","created_at") VALUES('4c5b6d45-a002-4f89-a7a3-600e67dafcfb','+254717724425','2026-08-08 05:04:21');
CREATE TABLE rate_limits (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    bucket TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0
  );
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
DELETE FROM sqlite_sequence;
CREATE UNIQUE INDEX idx_customers_phone ON customers (phone);
CREATE UNIQUE INDEX idx_subscribers_phone ON subscribers (phone);
CREATE UNIQUE INDEX idx_inventory_variation
    ON inventory (product_id, COALESCE(color_id, ''), COALESCE(size_id, ''));
