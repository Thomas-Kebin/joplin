<?php

namespace AppBundle;

class Eloquent {

	private $capsule_ = null;

	public function __construct() {
		$this->capsule_ = new \Illuminate\Database\Capsule\Manager();

		$this->capsule_->addConnection([
			'driver'    => 'mysql',
			'host'      => 'localhost',
			'database'  => 'notes',
			'username'  => 'root',
			'password'  => 'pass',
			'charset'   => 'utf8',
			'collation' => 'utf8_unicode_ci',
			'prefix'    => '',
		]);

		$this->capsule_->bootEloquent();
	}

	public function connection() {
		return $this->capsule_->getConnection('default');
	}

}