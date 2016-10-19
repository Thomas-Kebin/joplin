<?php

namespace AppBundle\Controller;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use AppBundle\Controller\ApiController;
use AppBundle\Model\Note;

class NotesController extends ApiController {

	/**
	 * @Route("/notes")
	 */
	public function allAction(Request $request) {
		if ($request->isMethod('POST')) {
			$note = new Note();
			$note->fromPublicArray($request->request->all());
			$note->owner_id = $this->user()->id;
			$note->save();
			return static::successResponse($note->toPublicArray());
		}

		return static::errorResponse('Invalid method');
	}

	/**
	 * @Route("/notes/{id}")
	 */
	public function oneAction($id, Request $request) {
		$note = Note::find(Note::unhex($id));
		if (!$note && !$request->isMethod('PUT')) return static::errorResponse('Not found', 0, 404);	

		if ($request->isMethod('GET')) {
			return static::successResponse($note);
		}

		if ($request->isMethod('PUT')) {
			$data = $this->putParameters();
			$isNew = !$note;
			if ($isNew) $note = new Note();
			foreach ($data as $n => $v) {
				if ($n == 'parent_id') $v = Note::unhex($v);
				$note->{$n} = $v;
			}
			$note->id = Note::unhex($id);
			$note->owner_id = $this->user()->id;
			$note->setIsNew($isNew);
			$note->save();
			return static::successResponse($note);
		}

		if ($request->isMethod('PATCH')) {
			$data = $this->patchParameters();
			foreach ($data as $n => $v) {
				$note->{$n} = $v;
			}
			$note->save();
			return static::successResponse($note);
		}

		if ($request->isMethod('DELETE')) {
			$note->delete();
			return static::successResponse();
		}

		return static::errorResponse('Invalid method');
	}

}
