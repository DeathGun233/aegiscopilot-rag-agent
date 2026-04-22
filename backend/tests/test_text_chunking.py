from __future__ import annotations

from app.services.text import split_into_chunks


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
