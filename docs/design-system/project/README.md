Lamo es una herramienta de producción creativa con estética japonesa minimalista y trazo a mano: papel washi, tinta sumi y un único punto rojo. Mucho espacio vacío (*ma*), formas redondeadas como los trazos del logo y pequeños garabatos que recuerdan que detrás hay personas.

## Principios

- **Papel y tinta primero.** La página es `paper`; lo que se lee o se toca va en `surface` con borde `line`. Texto en `ink`, `ink-soft` o `ink-faint` según su importancia.
- **Un solo rojo.** `shu` marca la identidad y lo que está activo: el punto del menú, el subrayado del título, el enso de progreso y el foco. Si todo es rojo, nada lo es: no lo uses para decorar.
- **El estado se dice con color y con palabras.** Cada insignia combina un tono `*-soft` de fondo con su tono oscuro de texto y siempre lleva texto («Bloqueada», «En revisión»), nunca solo color.
- **Garabato con medida.** Un trazo a mano por bloque como mucho: el subrayado del título, una frase en `lead`, el enso. La interfaz sigue siendo limpia.
- **Separar con bordes, no con sombras.** Las sombras (`shadow-*`) solo marcan lo que flota: menús, diálogos, el panel.

## Color

| Rol | Tokens | Uso |
| --- | --- | --- |
| Fondos | `paper`, `surface` | `paper` para la página; `surface` para tarjetas, campos, diálogos |
| Bordes | `line`, `line-soft` | Borde de 1px en tarjetas, campos y chips; divisores al 60 % |
| Texto | `ink`, `ink-soft`, `ink-faint` | Principal · secundario e iconos · metadatos |
| Marca | `shu` | Logo, elemento activo, subrayado a mano, enso, foco, botón de acento |
| Alerta | `coral` sobre `coral-soft` | Con retraso, bloqueada, borrar, errores |
| Hecho | `moss` sobre `moss-soft` | Hecha, aprobado |
| Revisión | `honey` sobre `honey-soft` | En revisión, pendiente de cliente, prioridad alta |
| En curso | `ocean` sobre `ocean-soft` | En curso, planificación |
| Producción | `plum` sobre `plum-soft` | En producción, sobrecarga del equipo |
| Portadas | `cover-shu`, `cover-kincha`, `cover-matcha`, `cover-ai`, `cover-fuji`, `cover-sumi` | Punto de color de cada proyecto |

Correspondencia de estados en la app:

- **Tareas:** Por hacer (neutro) · En curso (`ocean`) · En revisión (`honey`) · Hecha (`moss`). «Bloqueada» es una marca aparte en `coral`.
- **Proyectos:** Borrador y Cerrado (neutro) · Planificación (`ocean`) · En producción (`plum`) · En revisión y Pendiente de cliente (`honey`) · Cambios solicitados (`coral`) · Aprobado (`moss`).
- **Prioridad:** Baja (neutro) · Media (`ocean`) · Alta (`honey`) · Urgente (`coral`), con el icono de bandera.

Reglas:

- Pon el texto de cuerpo en `ink` sobre `surface` o `paper`.
- Nunca pongas texto pequeño en `shu`. Para texto de alerta usa `coral`.
- El color de portada de un proyecto aparece solo como un punto redondo de 8–12px junto a su nombre, nunca como fondo.
- Usa los neutros con opacidad para estados de interacción: `ink` al 5 % para hover de botones fantasma, al 3 % para hover de filas.

## Tipografía

Solo dos estilos en todo el proyecto: **Helvetica** y **Helvetica Light**. Se usan las fuentes instaladas en el equipo (no se sirve ningún archivo), reunidas bajo la familia `Lamo Helvetica`:

```css
@font-face { font-family: "Lamo Helvetica"; font-weight: 100 349; src: local("Helvetica Light"), local("Helvetica-Light"), local("Helvetica Neue Light"); }
@font-face { font-family: "Lamo Helvetica"; font-weight: 350 1000; src: local("Helvetica"), local("Helvetica Neue"); }
font-family: "Lamo Helvetica", "Helvetica Neue", Helvetica, Arial, sans-serif;
```

- **Helvetica Light** (300): títulos de página, cifras, nombres de proyecto y la voz cercana de la app (subtítulos, pistas, notas). Nunca por debajo de 14px.
- **Helvetica** (400): todo lo demás: texto, botones, menú, insignias, encabezados de tarjeta.
- No hay negrita: la jerarquía se hace con tamaño, con el contraste Light/normal y con color (`ink`, `ink-soft`, `ink-faint`). Un `font-weight` de 500 o 700 sigue mostrando Helvetica normal.
- Sin Helvetica instalada, el navegador usa Helvetica Neue (Mac) o Arial (Windows).

Escala: `metric` 36 · `page-title` 32 · `panel-title` 24 · `project-name` 20 · `dialog-title` 18 · `card-title` y `lead` 16 · `note` 15 · `body` y `hint` 14 · `small` 12 · `eyebrow` 11 (mayúsculas con 0.14em de espaciado).

## Garabatos

Los gestos a mano son la firma visual de Lamo. Todos se dibujan con SVG de trazo redondeado.

- **Subrayado de título:** una línea ondulada en `shu` de 72 × 10px bajo cada `page-title`, alineada a la izquierda. Bajo la pestaña activa de un proyecto aparece una versión más corta.
- **Enso:** el progreso (0–100 %) se dibuja como un círculo de pincel en `shu` sobre una pista punteada de `ink` al 15 %. A 0 % queda un solo punto, como el del logo. Tamaños: 30, 44, 48, 64, 72 y 120px.
- **Check a mano:** al marcar una tarea, el círculo vacío se rellena con un check trazado en `shu`.
- **Dibujos de estado vacío:** círculo con punto (vacío), montaña con sol (todo en calma) y papel (sin notas), en `ink` al 45 % con un punto `shu`.
- **Punto shu:** el punto rojo del logo marca la sección activa del menú, una nota fijada y una tarjeta bloqueada.

## Espacio, formas y profundidad

- Escala de 4px: `space-1` … `space-10`. Márgenes de página de `space-10` en escritorio y `space-4` en móvil; relleno de tarjeta `space-5`.
- Botones, chips, insignias, avatares y buscador son píldoras (`radius-full`). Tarjetas y columnas usan `radius-2xl`; campos, `radius-xl`; teclas, `radius-md`.
- El fondo `paper` lleva un grano de ruido muy sutil (5 % de opacidad) que evoca el papel.
- Movimiento corto y funcional: transiciones de color de 150ms, tarjetas que suben 2px al pasar el ratón, enso que se dibuja en 700ms. Nada decorativo.

## Iconos

Set propio de iconos de trazo sobre una cuadrícula de 24px: trazo de 1.75px, extremos y uniones redondeados, sin relleno, en `currentColor`. Tamaños habituales: 13–17px en interfaz y 26px en estados vacíos. Sin emoji en la interfaz, salvo el «✿» del saludo de bienvenida.

## Logo

El símbolo son dos lazos apilados con un punto, en `shu` sobre `paper`. Úsalo en `shu` sobre `paper` o `surface`; nunca lo recolores ni lo pongas sobre `ink`. El nombre «LAMO» va en mayúsculas, en Helvetica y en `shu`, con 0.12em de espaciado. Los archivos están en el grupo Logos.

## Voz y textos

- **Tuteo y frases cortas.** «Arrastra las tarjetas entre columnas para cambiar su estado.»
- **Mayúscula solo al inicio**, salvo nombres propios: «Nueva tarea», «Próximas tareas».
- **Los botones dicen lo que hacen:** «Crear tarea», «Guardar nota», «Desbloquear». El aviso confirma con el mismo verbo: «Tarea creada».
- **Calma, no alarma.** Los mensajes de estado vacío tranquilizan: «Todo en calma», «Respira: no hay entregas en estas fechas».
- **Los errores dicen qué pasó y qué hacer:** «“bruto.mov” pesa 26 MB; el máximo es 25 MB. Para brutos pesados, añade un enlace a Drive o Frame.io.»
- **Lenguaje inclusivo sin barras cuando se puede:** «Te damos la bienvenida» en lugar de «Bienvenido/a».

## Accesibilidad

- El foco visible es un contorno de 2px en `shu` con 2px de separación. Sobre `surface` da 3.4:1; sobre `paper` solo 2.8:1, por debajo de 3:1, así que los controles que pueden recibir foco viven sobre `surface` o llevan borde `line`.
- `ink-faint` sobre `paper` (4.1:1) y `coral` sobre `coral-soft` (3.9:1) no llegan a 4.5:1: úsalos con peso medium y siempre con palabra o icono que no dependa del color.
- El botón de acento (`surface`/blanco sobre `shu`, 3.7:1) es para llamadas puntuales con texto medium; el botón principal de la app es `ink`.
- Todo atajo de teclado tiene también un botón, y todo gesto de arrastrar tiene una alternativa: botones de estado, flechas de orden y `Shift + ←/→`.
