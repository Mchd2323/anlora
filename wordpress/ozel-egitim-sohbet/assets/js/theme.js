/**
 * Özel Eğitim Sohbet — arayüz betiği.
 *
 * Tek işi, konuşma listesindeki sıralama seçimi değişince formu göndermek.
 * JavaScript kapalıyken form kendi "Ara" düğmesiyle çalışmaya devam eder.
 */
( function () {
	'use strict';

	document.documentElement.classList.add( 'js' );

	document.addEventListener( 'change', function ( event ) {
		var field = event.target;

		if ( ! field || ! field.hasAttribute || ! field.hasAttribute( 'data-oec-autosubmit' ) ) {
			return;
		}

		var form = field.form;
		if ( form ) {
			form.submit();
		}
	} );
}() );
