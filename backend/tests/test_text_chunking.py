from __future__ import annotations

from app.services.text import split_into_chunks, split_into_structured_chunks


def test_split_into_chunks_preserves_policy_list_context() -> None:
    text = (
        "中山大学硕士研究生招生包括学术学位和专业学位两种类型。\n"
        "一、报考条件\n"
        "（一）报名参加全国硕士研究生招生考试的人员，须符合下列条件：\n"
        "1. 中华人民共和国公民。\n"
        "2. 拥护中国共产党的领导，遵纪守法，品德良好。\n"
        "3. 身体健康状况符合国家和中山大学规定的体检要求。\n"
        "4. 考生学业水平必须符合下列条件之一：\n"
        "（1）国家承认学历的应届本科毕业生及自学考试和网络教育届时可毕业本科生。"
        "考生录取当年入学前必须取得国家承认的本科毕业证书或教育部留学服务中心"
        "出具的《国（境）外学历学位认证书》。\n"
        "（2）具有国家承认的本科毕业学历的人员。\n"
        "（3）获得国家承认的高职（专科）毕业学历后满2年及以上人员，或国家承认学历"
        "的本科结业生，按本科毕业同等学力身份报考。\n"
    )

    chunks = split_into_chunks(text)

    assert "身体健康状况符合国家和中山大学规定的体检要求" in chunks[0]
    assert "国家承认的本科毕业证书" in chunks[0]
    assert "按本科毕业同等学力身份报考" in chunks[0]


def test_structured_chunks_group_admission_condition_sections() -> None:
    text = """
中山大学2026年考试招收硕士研究生招生简章

一、报考条件
（一）报名参加全国硕士研究生招生考试的人员，须符合下列条件：
1. 中华人民共和国公民。
2. 拥护中国共产党的领导，遵纪守法，品德良好。
3. 身体健康状况符合国家和中山大学规定的体检要求。
4. 考生学业水平必须符合下列条件之一：
（1）国家承认学历的应届本科毕业生。
（2）具有国家承认的本科毕业学历的人员。

（二）报考医学临床学科学术学位的人员，须符合医学培养要求。
1. 只接受授医学学位的毕业生报考。

（三）报考法律硕士（非法学）专业学位的人员，报考前所学专业为非法学专业。
（四）报考工商管理、公共管理、旅游管理等管理类专业学位的人员，须符合工作年限要求。
（五）报名参加单独考试的人员，须经所在单位同意并具有相应工作经历。

二、报名
考生应按教育部和学校要求完成网上报名。
"""

    chunks = split_into_structured_chunks(text, chunk_size=360)
    by_title = {chunk.metadata["section_title"]: chunk for chunk in chunks}

    assert "报名参加全国硕士研究生招生考试的人员，须符合下列条件：" in by_title
    assert "报考医学临床学科学术学位的人员，须符合医学培养要求。" in by_title
    assert "报考法律硕士（非法学）专业学位的人员，报考前所学专业为非法学专业。" in by_title
    assert "报考工商管理、公共管理、旅游管理等管理类专业学位的人员，须符合工作年限要求。" in by_title
    assert "报名参加单独考试的人员，须经所在单位同意并具有相应工作经历。" in by_title

    basic = by_title["报名参加全国硕士研究生招生考试的人员，须符合下列条件："]
    assert basic.metadata["section_path"] == "报考条件 > 报名参加全国硕士研究生招生考试的人员，须符合下列条件："
    assert basic.metadata["section_level"] == 2
    assert isinstance(basic.metadata["section_index"], int)
    assert "中华人民共和国公民" in basic.text
    assert "国家承认学历的应届本科毕业生" in basic.text
