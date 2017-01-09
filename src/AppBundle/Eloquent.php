<?php

namespace AppBundle;

class Eloquent {

	private $capsule_ = null;

	public function __construct($dbParams, $mimeTypes, $paths) {
		$this->capsule_ = new \Illuminate\Database\Capsule\Manager();

		$dbParamsDefaults = array(
			'driver'    => 'mysql',
			'charset'   => 'utf8',
			'collation' => 'utf8_unicode_ci',
			'prefix'    => '',
		);

		$dbParams = array_merge($dbParamsDefaults, $dbParams);

		$this->capsule_->addConnection($dbParams);
		$this->capsule_->bootEloquent();

		// In order to keep things lightweight, the models aren't part of Symfony dependency
		// injection framework, so any service required by a model needs to be injected here. 
		Model\File::$mimeTypes = $mimeTypes;
		Model\File::$paths = $paths;
	}

	public function connection() {
		return $this->capsule_->getConnection('default');
	}

}