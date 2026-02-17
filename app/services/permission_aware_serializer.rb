class PermissionAwareSerializer
  attr_reader :user, :auth

  def initialize(user)
    @user = user
    @auth = AuthorizationService.new(user)
  end

  def serialize_source(source)
    is_owner = source.user_id == user.id
    permission = source.permission_for(user)

    result = source.as_json

    # Tags only visible to owner
    result['tags'] = is_owner ? source.tags.pluck(:name) : []

    # Show connections but mark accessibility
    accessible_concept_ids = auth.accessible_ids(Concept)
    accessible_people_ids = auth.accessible_ids(Person)

    result['concepts'] = source.concepts.map do |c|
      {
        id: c.id,
        label: c.label,
        accessible: accessible_concept_ids.include?(c.id)
      }
    end

    result['people'] = source.people.map do |p|
      {
        id: p.id,
        full_name: p.full_name,
        accessible: accessible_people_ids.include?(p.id)
      }
    end

    result['permission'] = permission
    result['can_edit'] = permission.in?(%w[owner editor collaborator])
    result['can_collaborate'] = permission.in?(%w[owner collaborator])

    result
  end

  def serialize_concept(concept)
    is_owner = concept.user_id == user.id
    permission = concept.permission_for(user)

    result = concept.as_json

    accessible_source_ids = auth.accessible_ids(Source)
    accessible_people_ids = auth.accessible_ids(Person)
    accessible_note_ids = auth.accessible_ids(Note)

    result['sources'] = concept.sources.map do |s|
      {
        id: s.id,
        title: s.title,
        accessible: accessible_source_ids.include?(s.id)
      }
    end

    result['people'] = concept.people.map do |p|
      {
        id: p.id,
        full_name: p.full_name,
        accessible: accessible_people_ids.include?(p.id)
      }
    end

    result['linked_notes'] = concept.linked_notes.map do |n|
      {
        id: n.id,
        title: n.title,
        accessible: accessible_note_ids.include?(n.id)
      }
    end

    result['permission'] = permission
    result['can_edit'] = permission.in?(%w[owner editor collaborator])
    result['can_collaborate'] = permission.in?(%w[owner collaborator])

    result
  end

  def serialize_person(person)
    is_owner = person.user_id == user.id
    permission = person.permission_for(user)

    result = person.as_json

    # Tags only visible to owner
    result['tags'] = is_owner ? person.tags.pluck(:name) : []

    accessible_source_ids = auth.accessible_ids(Source)
    accessible_concept_ids = auth.accessible_ids(Concept)
    accessible_note_ids = auth.accessible_ids(Note)

    result['sources'] = person.sources.map do |s|
      {
        id: s.id,
        title: s.title,
        accessible: accessible_source_ids.include?(s.id)
      }
    end

    result['concepts'] = person.concepts.map do |c|
      {
        id: c.id,
        label: c.label,
        accessible: accessible_concept_ids.include?(c.id)
      }
    end

    result['notes'] = person.notes.map do |n|
      {
        id: n.id,
        title: n.title,
        accessible: accessible_note_ids.include?(n.id)
      }
    end

    result['permission'] = permission
    result['can_edit'] = permission.in?(%w[owner editor collaborator])
    result['can_collaborate'] = permission.in?(%w[owner collaborator])

    result
  end

  def serialize_note(note)
    is_owner = note.user_id == user.id
    permission = note.permission_for(user)

    result = note.as_json

    # Tags only visible to owner
    result['tags'] = is_owner ? note.tags.pluck(:name) : []

    accessible_source_ids = auth.accessible_ids(Source)
    accessible_concept_ids = auth.accessible_ids(Concept)
    accessible_people_ids = auth.accessible_ids(Person)

    if note.source
      result['source'] = {
        id: note.source.id,
        title: note.source.title,
        accessible: accessible_source_ids.include?(note.source.id)
      }
    end

    result['concepts'] = note.concepts.map do |c|
      {
        id: c.id,
        label: c.label,
        accessible: accessible_concept_ids.include?(c.id)
      }
    end

    result['people'] = note.people.map do |p|
      {
        id: p.id,
        full_name: p.full_name,
        accessible: accessible_people_ids.include?(p.id)
      }
    end

    result['permission'] = permission
    result['can_edit'] = permission.in?(%w[owner editor collaborator])
    result['can_collaborate'] = permission.in?(%w[owner collaborator])

    result
  end
end
