"""Profile CRUD + business rules — BR-A03 (1:1 profile), BR-A04 (ID-number uniqueness),
ownership isolation (ST-2.3), and PII-at-rest (TAD §4.4). Behaviour-named tests (S7.5)."""

from __future__ import annotations

from tests.profile.conftest import BASE, bearer, register_student, valid_profile

PROFILE = f"{BASE}/students/me/profile"
DATA_EXPORT = f"{BASE}/students/me/data-export"


def test_data_export_bundles_my_data_without_the_raw_id_popia_15_6(profile_client):
    """POPIA §15.6: the export returns all we hold on the caller — but never the raw SA ID."""
    secret_id = "9001011234099"
    token, _ = register_student(profile_client)
    profile_client.put(PROFILE, headers=bearer(token), json=valid_profile(id_number=secret_id))
    resp = profile_client.get(DATA_EXPORT, headers=bearer(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["subject"]["sa_id_on_file"] is True  # we say it is on file...
    assert secret_id not in resp.text  # ...but never echo the number itself (TAD §4.4)
    assert body["profile"]["first_name"]  # profile present
    for section in ("applications", "documents", "consents"):
        assert section in body  # all subject-data sections present (consents from registration)


def test_data_export_requires_authentication(profile_client):
    assert profile_client.get(DATA_EXPORT).status_code == 401


def test_get_profile_returns_404_before_creation(profile_client):
    token, _ = register_student(profile_client)
    resp = profile_client.get(PROFILE, headers=bearer(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "profile_not_found"


def test_get_profile_requires_authentication(profile_client):
    assert profile_client.get(PROFILE).status_code == 401


def test_put_creates_then_get_returns_profile_br_a03(profile_client):
    token, uid = register_student(profile_client)
    put = profile_client.put(PROFILE, headers=bearer(token), json=valid_profile())
    assert put.status_code == 200, put.text
    body = put.json()
    assert body["id"] == uid  # PK = FK: profile id IS the user id (1:1 subtype, BR-A03)
    assert body["first_name"] == "Thandi"
    assert body["verification_level"] == "BRONZE"  # default ladder start
    got = profile_client.get(PROFILE, headers=bearer(token))
    assert got.status_code == 200
    assert got.json()["field_of_study"] == "BSc Computer Science"


def test_put_twice_updates_the_same_single_profile_br_a03(profile_client):
    token, uid = register_student(profile_client)
    profile_client.put(PROFILE, headers=bearer(token), json=valid_profile())
    second = profile_client.put(
        PROFILE, headers=bearer(token), json=valid_profile(field_of_study="BCom Accounting")
    )
    assert second.status_code == 200
    assert second.json()["id"] == uid  # still one profile — upsert, never a duplicate (BR-A03)
    assert second.json()["field_of_study"] == "BCom Accounting"


def test_a_student_says_which_language_to_write_to_them_in_d008(profile_client):
    """D-008. The column existed from migration 0004 and was in no contract, no endpoint and no
    screen — so nobody was ever asked, and English was a default rather than a choice (#315)."""
    token, _ = register_student(profile_client)

    # Not asked ⇒ English, because that is what the column defaults to. Stated, not inferred.
    created = profile_client.put(PROFILE, headers=bearer(token), json=valid_profile())
    assert created.json()["preferred_language"] == "en"

    chosen = profile_client.put(
        PROFILE, headers=bearer(token), json=valid_profile(preferred_language="nso")
    )
    assert chosen.status_code == 200, chosen.text
    assert chosen.json()["preferred_language"] == "nso"
    # It survives the round trip, and it is in the POPIA export like everything else we hold.
    assert profile_client.get(PROFILE, headers=bearer(token)).json()["preferred_language"] == "nso"
    export = profile_client.get(DATA_EXPORT, headers=bearer(token)).json()
    assert export["profile"]["preferred_language"] == "nso"


def test_only_an_official_south_african_language_is_accepted_d008(profile_client):
    """ck_sp_language lists eleven languages; the API must refuse the twelfth before the database
    has to, so a student sees a validation error and not a 500."""
    token, _ = register_student(profile_client)
    refused = profile_client.put(
        PROFILE, headers=bearer(token), json=valid_profile(preferred_language="fr")
    )
    assert refused.status_code == 422
    assert profile_client.get(PROFILE, headers=bearer(token)).status_code == 404  # nothing written

    for language in ("en", "af", "nr", "xh", "zu", "nso", "st", "tn", "ss", "ve", "ts"):
        ok = profile_client.put(
            PROFILE, headers=bearer(token), json=valid_profile(preferred_language=language)
        )
        assert ok.status_code == 200, f"{language}: {ok.text}"
        assert ok.json()["preferred_language"] == language


def test_put_rejects_invalid_level(profile_client):
    token, _ = register_student(profile_client)
    resp = profile_client.put(PROFILE, headers=bearer(token), json=valid_profile(level="DIPLOMA"))
    assert resp.status_code == 422


def test_profiles_are_isolated_per_user_st_2_3(profile_client):
    """A's profile is invisible to B — /me resources confine each caller to their own row."""
    a_token, _ = register_student(profile_client)
    b_token, _ = register_student(profile_client)
    profile_client.put(PROFILE, headers=bearer(a_token), json=valid_profile(first_name="Alice"))
    # B has created nothing → sees 404, never A's row.
    assert profile_client.get(PROFILE, headers=bearer(b_token)).status_code == 404
    profile_client.put(PROFILE, headers=bearer(b_token), json=valid_profile(first_name="Bongani"))
    assert profile_client.get(PROFILE, headers=bearer(a_token)).json()["first_name"] == "Alice"
    assert profile_client.get(PROFILE, headers=bearer(b_token)).json()["first_name"] == "Bongani"


def test_id_number_uniqueness_across_users_br_a04(profile_client):
    """One SA ID number identifies at most one user — the second claimant is rejected (409)."""
    a_token, _ = register_student(profile_client)
    b_token, _ = register_student(profile_client)
    id_num = "9001011234088"
    assert profile_client.put(
        PROFILE, headers=bearer(a_token), json=valid_profile(id_number=id_num)
    ).status_code == 200
    clash = profile_client.put(
        PROFILE, headers=bearer(b_token), json=valid_profile(id_number=id_num)
    )
    assert clash.status_code == 409
    assert clash.json()["error"]["code"] == "id_number_taken"


def test_owner_may_resubmit_their_own_id_number_br_a04(profile_client):
    token, _ = register_student(profile_client)
    id_num = "8506152345087"
    assert profile_client.put(
        PROFILE, headers=bearer(token), json=valid_profile(id_number=id_num)
    ).status_code == 200
    # Same owner, same number, second PUT — allowed (owner == self), not a uniqueness clash.
    assert profile_client.put(
        PROFILE, headers=bearer(token), json=valid_profile(id_number=id_num, phone="0830000000")
    ).status_code == 200


def test_id_number_is_encrypted_and_blind_indexed_at_rest_br_a04(profile_client, admin_conn):
    """TAD §4.4: the ID number is never stored in plaintext; a blind index backs uniqueness."""
    token, uid = register_student(profile_client)
    id_num = "7012075432081"
    profile_client.put(PROFILE, headers=bearer(token), json=valid_profile(id_number=id_num))
    row = admin_conn.execute(
        'SELECT id_number_enc, id_number_blind_idx FROM "user" WHERE id = %s', (uid,)
    ).fetchone()
    enc, blind = row
    assert enc is not None and bytes(enc) != id_num.encode()  # ciphertext, not plaintext
    assert id_num.encode() not in bytes(enc)
    assert blind is not None and blind != id_num  # HMAC digest, not the raw number
