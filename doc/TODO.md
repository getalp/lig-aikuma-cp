# TODO
Dans ce fichier, certains points sont des suppositions et il sera nécessaire de les préciser.

L'application nécessite 5 modes :
- Recording
- Respeaking
- Translating
- Elicitation
- Check (pas encore décrit)

## Resources préexistantes
- [Tutoriel PDF](https://lig-aikuma.imag.fr/wp-content/uploads/2017/06/LIG-Aikuma_tutorial-fr.pdf)
- [Tutoriel Youtube](https://youtu.be/5_KrKZmE09A)

## Stockage des enregistrements
Les enregistements doivent être stockés dans un dossier de l'application, chaque enregistrement
doit être stocké dans un dossier, ce dossier doit contenir de fichier brut d'enregistrement (.wav),
les métadonnées (.json) ainsi que tout autre variante de l'enregistrement d'origine.
Les enregistrement "respeakés" ou traduits par exemple sont stocké dans ce dossier.

Le dossier de l'enregistrement est nommé en fonction de :
- La date et l'heure
- La langue (cela peut poser problème si on modifie les métadonnées, mais partons du principe que cela
  sera soit impossible de changer la langue, soit il sera proposé de renommer le dossier)
- L'identifiant de la machine

Le nommage du dossier pourra potentiellement être amélioré, à voir.

## Mode recording
Le mode recording permet d'enregistrer un audio lié à des métadonnées, ces métadonnées doivent
être les suivantes :
- Langue de l'enregistrement
- Nom du locuteur

Les métadonnées suivantes sont optionnelles :
- Langue maternelle 
- Langues supplémentaires 
- Region d'origine 
- Note 
- Année de naissance 
- Genre

Une fois les métadonnées entrées, il doit être permis d'enregistrer en plusieurs morceaux.
La durée de l'enregistrement doit être affiché et rafraichis en direct.

## Mode respeaking et translating
Ces deux modes ont un fonctionnement similaire mais n'ont pas le même but, le respeaking a pour but
de réenregistrer une enregistrement brut bruité afin d'en améliorer la qualité, la traduction a pour
but de traduire un enregistrement.

Dans ces modes, il faut sélectionner un fichier son (.wav) existant. La sélection doit permettre 
de selectionner des enregistrement existants (actuellement cela passe par un explorateur de
fichier intégré mais il pourrait être plus simple d'avoir une liste plus ergonomique).

Une fois le fichier sélectionné on peut modifier éventuellement les métadonnées existantes.

Ceci est une supposition, mais l'ancien logiciel semble détecter automatiquement les segments
parlés. Il est possible de forcer le logiciel à ne pas considérer un segment comme parlé.

Chaque segment parlé peut alors être réenregistré, on peut également lire le segment d'origine et
le segment réenregistré.

## Mode elicitation
Ce mode est une forme d'enregistrement (se référer à [la section dédié](#mode-recording)) mais 
organisé sous forme de liste de textes, de vidéos ou d'images à enregistrer une par une.

Pour le mode texte, il doit être possible de sélectionner un fichier texte (.txt) avec une phrase
par ligne et optionnellement la traduction dans le langage de l'expérimentateur.

Les métadonnées de l'élicitation doivent être sauvegardées avec le fichier audio pour garder la
durée et les temps de chaque phrase, vidéo ou image.

## Demandes particulières
- Pouvoir vite transférer sur navigateur
- Minimum qualité audio : 16kHz 16bit (.wav)
