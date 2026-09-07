/* ==== data.js ==== */
/* ===== 拾心界 - 预置示例数据 ===== */

const DefaultData = {
  // 预置示例聊天数据已彻底移除（chat_1~chat_4 及对应 14 条示例消息），
  // 避免未添加角色时出现"幽灵"聊天记录；真实聊天由用户添加角色后生成。

  // 预置聊天消息（已移除示例数据，保留空实现以兼容潜在调用）
  getMessages(chatId) {
    return [];
  },

  // 预置字卡
  cards: [],

  // 预置 emoji（按主流输入法分类，覆盖常用表情）
  emojis: [
    // === 笑脸与表情 ===
    { id: 'e001', char: '😀', category: '笑脸与表情' },{ id: 'e002', char: '😃', category: '笑脸与表情' },{ id: 'e003', char: '😄', category: '笑脸与表情' },
    { id: 'e004', char: '😁', category: '笑脸与表情' },{ id: 'e005', char: '😆', category: '笑脸与表情' },{ id: 'e006', char: '😅', category: '笑脸与表情' },
    { id: 'e007', char: '😂', category: '笑脸与表情' },{ id: 'e008', char: '🤣', category: '笑脸与表情' },{ id: 'e009', char: '😊', category: '笑脸与表情' },
    { id: 'e010', char: '😇', category: '笑脸与表情' },{ id: 'e011', char: '🙂', category: '笑脸与表情' },{ id: 'e012', char: '😉', category: '笑脸与表情' },
    { id: 'e013', char: '😌', category: '笑脸与表情' },{ id: 'e014', char: '😍', category: '笑脸与表情' },{ id: 'e015', char: '🥰', category: '笑脸与表情' },
    { id: 'e016', char: '😘', category: '笑脸与表情' },{ id: 'e017', char: '😗', category: '笑脸与表情' },{ id: 'e018', char: '😙', category: '笑脸与表情' },
    { id: 'e019', char: '😚', category: '笑脸与表情' },{ id: 'e020', char: '😋', category: '笑脸与表情' },{ id: 'e021', char: '😛', category: '笑脸与表情' },
    { id: 'e022', char: '😜', category: '笑脸与表情' },{ id: 'e023', char: '😝', category: '笑脸与表情' },{ id: 'e024', char: '🤪', category: '笑脸与表情' },
    { id: 'e025', char: '🤨', category: '笑脸与表情' },{ id: 'e026', char: '🧐', category: '笑脸与表情' },{ id: 'e027', char: '🤓', category: '笑脸与表情' },
    { id: 'e028', char: '😎', category: '笑脸与表情' },{ id: 'e029', char: '🤩', category: '笑脸与表情' },{ id: 'e030', char: '🥳', category: '笑脸与表情' },
    { id: 'e031', char: '😏', category: '笑脸与表情' },{ id: 'e032', char: '😒', category: '笑脸与表情' },{ id: 'e033', char: '😞', category: '笑脸与表情' },
    { id: 'e034', char: '😔', category: '笑脸与表情' },{ id: 'e035', char: '😟', category: '笑脸与表情' },{ id: 'e036', char: '😕', category: '笑脸与表情' },
    { id: 'e037', char: '🙁', category: '笑脸与表情' },{ id: 'e038', char: '😣', category: '笑脸与表情' },{ id: 'e039', char: '😖', category: '笑脸与表情' },
    { id: 'e040', char: '😫', category: '笑脸与表情' },{ id: 'e041', char: '😩', category: '笑脸与表情' },{ id: 'e042', char: '🥺', category: '笑脸与表情' },
    { id: 'e043', char: '😢', category: '笑脸与表情' },{ id: 'e044', char: '😭', category: '笑脸与表情' },{ id: 'e045', char: '😤', category: '笑脸与表情' },
    { id: 'e046', char: '😠', category: '笑脸与表情' },{ id: 'e047', char: '😡', category: '笑脸与表情' },{ id: 'e048', char: '🤬', category: '笑脸与表情' },
    { id: 'e049', char: '🤯', category: '笑脸与表情' },{ id: 'e050', char: '😳', category: '笑脸与表情' },{ id: 'e051', char: '🥵', category: '笑脸与表情' },
    { id: 'e052', char: '🥶', category: '笑脸与表情' },{ id: 'e053', char: '😱', category: '笑脸与表情' },{ id: 'e054', char: '😨', category: '笑脸与表情' },
    { id: 'e055', char: '😰', category: '笑脸与表情' },{ id: 'e056', char: '😥', category: '笑脸与表情' },{ id: 'e057', char: '😓', category: '笑脸与表情' },
    { id: 'e058', char: '🤗', category: '笑脸与表情' },{ id: 'e059', char: '🤔', category: '笑脸与表情' },{ id: 'e060', char: '🤭', category: '笑脸与表情' },
    { id: 'e061', char: '🤫', category: '笑脸与表情' },{ id: 'e062', char: '🤥', category: '笑脸与表情' },{ id: 'e063', char: '😶', category: '笑脸与表情' },
    { id: 'e064', char: '😐', category: '笑脸与表情' },{ id: 'e065', char: '😑', category: '笑脸与表情' },{ id: 'e066', char: '😬', category: '笑脸与表情' },
    { id: 'e067', char: '🙄', category: '笑脸与表情' },{ id: 'e068', char: '😯', category: '笑脸与表情' },{ id: 'e069', char: '😦', category: '笑脸与表情' },
    { id: 'e070', char: '😧', category: '笑脸与表情' },{ id: 'e071', char: '😮', category: '笑脸与表情' },{ id: 'e072', char: '😲', category: '笑脸与表情' },
    { id: 'e073', char: '🥱', category: '笑脸与表情' },{ id: 'e074', char: '😴', category: '笑脸与表情' },{ id: 'e075', char: '🤤', category: '笑脸与表情' },
    { id: 'e076', char: '😪', category: '笑脸与表情' },{ id: 'e077', char: '😷', category: '笑脸与表情' },{ id: 'e078', char: '🤒', category: '笑脸与表情' },
    { id: 'e079', char: '🤕', category: '笑脸与表情' },{ id: 'e080', char: '🤢', category: '笑脸与表情' },{ id: 'e081', char: '🤮', category: '笑脸与表情' },
    { id: 'e082', char: '😵', category: '笑脸与表情' },{ id: 'e083', char: '🥴', category: '笑脸与表情' },{ id: 'e084', char: '🤧', category: '笑脸与表情' },
    { id: 'e085', char: '🥸', category: '笑脸与表情' },{ id: 'e086', char: '😈', category: '笑脸与表情' },{ id: 'e087', char: '👿', category: '笑脸与表情' },
    { id: 'e088', char: '💀', category: '笑脸与表情' },{ id: 'e089', char: '👻', category: '笑脸与表情' },{ id: 'e090', char: '👽', category: '笑脸与表情' },
    { id: 'e091', char: '🤖', category: '笑脸与表情' },{ id: 'e092', char: '💩', category: '笑脸与表情' },{ id: 'e093', char: '😺', category: '笑脸与表情' },
    { id: 'e094', char: '😸', category: '笑脸与表情' },{ id: 'e095', char: '😹', category: '笑脸与表情' },{ id: 'e096', char: '😻', category: '笑脸与表情' },

    // === 人物与手势 ===
    { id: 'e101', char: '👋', category: '人物与手势' },{ id: 'e102', char: '🤚', category: '人物与手势' },{ id: 'e103', char: '✋', category: '人物与手势' },
    { id: 'e104', char: '🖐', category: '人物与手势' },{ id: 'e105', char: '👌', category: '人物与手势' },{ id: 'e106', char: '🤌', category: '人物与手势' },
    { id: 'e107', char: '🤏', category: '人物与手势' },{ id: 'e108', char: '✌️', category: '人物与手势' },{ id: 'e109', char: '🤞', category: '人物与手势' },
    { id: 'e110', char: '🤟', category: '人物与手势' },{ id: 'e111', char: '🤘', category: '人物与手势' },{ id: 'e112', char: '🤙', category: '人物与手势' },
    { id: 'e113', char: '👈', category: '人物与手势' },{ id: 'e114', char: '👉', category: '人物与手势' },{ id: 'e115', char: '👆', category: '人物与手势' },
    { id: 'e116', char: '👇', category: '人物与手势' },{ id: 'e117', char: '🖕', category: '人物与手势' },{ id: 'e118', char: '👍', category: '人物与手势' },
    { id: 'e119', char: '👎', category: '人物与手势' },{ id: 'e120', char: '✊', category: '人物与手势' },{ id: 'e121', char: '👊', category: '人物与手势' },
    { id: 'e122', char: '🤛', category: '人物与手势' },{ id: 'e123', char: '🤜', category: '人物与手势' },{ id: 'e124', char: '👏', category: '人物与手势' },
    { id: 'e125', char: '🙌', category: '人物与手势' },{ id: 'e126', char: '👐', category: '人物与手势' },{ id: 'e127', char: '🤲', category: '人物与手势' },
    { id: 'e128', char: '🤝', category: '人物与手势' },{ id: 'e129', char: '🙏', category: '人物与手势' },{ id: 'e130', char: '💅', category: '人物与手势' },
    { id: 'e131', char: '💪', category: '人物与手势' },{ id: 'e132', char: '🦵', category: '人物与手势' },{ id: 'e133', char: '🦶', category: '人物与手势' },
    { id: 'e134', char: '👂', category: '人物与手势' },{ id: 'e135', char: '👃', category: '人物与手势' },{ id: 'e136', char: '👀', category: '人物与手势' },
    { id: 'e137', char: '👁', category: '人物与手势' },{ id: 'e138', char: '👅', category: '人物与手势' },{ id: 'e139', char: '👄', category: '人物与手势' },
    { id: 'e140', char: '👶', category: '人物与手势' },{ id: 'e141', char: '👧', category: '人物与手势' },{ id: 'e142', char: '👦', category: '人物与手势' },
    { id: 'e143', char: '👩', category: '人物与手势' },{ id: 'e144', char: '👨', category: '人物与手势' },{ id: 'e145', char: '👵', category: '人物与手势' },
    { id: 'e146', char: '👴', category: '人物与手势' },{ id: 'e147', char: '👮', category: '人物与手势' },{ id: 'e148', char: '👷', category: '人物与手势' },
    { id: 'e149', char: '💂', category: '人物与手势' },{ id: 'e150', char: '🕵', category: '人物与手势' },{ id: 'e151', char: '👩‍⚕️', category: '人物与手势' },
    { id: 'e152', char: '👨‍⚕️', category: '人物与手势' },{ id: 'e153', char: '👩‍🎓', category: '人物与手势' },{ id: 'e154', char: '👨‍🎓', category: '人物与手势' },
    { id: 'e155', char: '👩‍🏫', category: '人物与手势' },{ id: 'e156', char: '👨‍🏫', category: '人物与手势' },{ id: 'e157', char: '👩‍💻', category: '人物与手势' },
    { id: 'e158', char: '👨‍💻', category: '人物与手势' },{ id: 'e159', char: '👩‍🎤', category: '人物与手势' },{ id: 'e160', char: '👨‍🎤', category: '人物与手势' },
    { id: 'e161', char: '🧑‍🎄', category: '人物与手势' },{ id: 'e162', char: '🤶', category: '人物与手势' },{ id: 'e163', char: '🎅', category: '人物与手势' },
    { id: 'e164', char: '🧙', category: '人物与手势' },{ id: 'e165', char: '🧚', category: '人物与手势' },{ id: 'e166', char: '🧛', category: '人物与手势' },
    { id: 'e167', char: '🧜', category: '人物与手势' },{ id: 'e168', char: '🧝', category: '人物与手势' },{ id: 'e169', char: '🙇', category: '人物与手势' },
    { id: 'e170', char: '💁', category: '人物与手势' },{ id: 'e171', char: '🙅', category: '人物与手势' },{ id: 'e172', char: '🙆', category: '人物与手势' },
    { id: 'e173', char: '🙋', category: '人物与手势' },{ id: 'e174', char: '🙎', category: '人物与手势' },{ id: 'e175', char: '🙍', category: '人物与手势' },
    { id: 'e176', char: '💆', category: '人物与手势' },{ id: 'e177', char: '💇', category: '人物与手势' },{ id: 'e178', char: '🧖', category: '人物与手势' },
    { id: 'e179', char: '💃', category: '人物与手势' },{ id: 'e180', char: '🕺', category: '人物与手势' },{ id: 'e181', char: '👯', category: '人物与手势' },
    { id: 'e182', char: '🧑‍🤝‍🧑', category: '人物与手势' },{ id: 'e183', char: '👫', category: '人物与手势' },{ id: 'e184', char: '👬', category: '人物与手势' },
    { id: 'e185', char: '👭', category: '人物与手势' },{ id: 'e186', char: '💏', category: '人物与手势' },{ id: 'e187', char: '👪', category: '人物与手势' },
    { id: 'e188', char: '🗣', category: '人物与手势' },{ id: 'e189', char: '👤', category: '人物与手势' },{ id: 'e190', char: '👥', category: '人物与手势' },

    // === 动物与自然 ===
    { id: 'e201', char: '🐵', category: '动物与自然' },{ id: 'e202', char: '🐒', category: '动物与自然' },{ id: 'e203', char: '🦍', category: '动物与自然' },
    { id: 'e204', char: '🐶', category: '动物与自然' },{ id: 'e205', char: '🐕', category: '动物与自然' },{ id: 'e206', char: '🐩', category: '动物与自然' },
    { id: 'e207', char: '🐺', category: '动物与自然' },{ id: 'e208', char: '🦊', category: '动物与自然' },{ id: 'e209', char: '🦝', category: '动物与自然' },
    { id: 'e210', char: '🐱', category: '动物与自然' },{ id: 'e211', char: '🐈', category: '动物与自然' },{ id: 'e212', char: '🦁', category: '动物与自然' },
    { id: 'e213', char: '🐯', category: '动物与自然' },{ id: 'e214', char: '🐴', category: '动物与自然' },{ id: 'e215', char: '🐎', category: '动物与自然' },
    { id: 'e216', char: '🦄', category: '动物与自然' },{ id: 'e217', char: '🐮', category: '动物与自然' },{ id: 'e218', char: '🐷', category: '动物与自然' },
    { id: 'e219', char: '🐗', category: '动物与自然' },{ id: 'e220', char: '🐑', category: '动物与自然' },{ id: 'e221', char: '🐐', category: '动物与自然' },
    { id: 'e222', char: '🐪', category: '动物与自然' },{ id: 'e223', char: '🐘', category: '动物与自然' },{ id: 'e224', char: '🐭', category: '动物与自然' },
    { id: 'e225', char: '🐹', category: '动物与自然' },{ id: 'e226', char: '🐰', category: '动物与自然' },{ id: 'e227', char: '🐻', category: '动物与自然' },
    { id: 'e228', char: '🐨', category: '动物与自然' },{ id: 'e229', char: '🐼', category: '动物与自然' },{ id: 'e230', char: '🐔', category: '动物与自然' },
    { id: 'e231', char: '🐧', category: '动物与自然' },{ id: 'e232', char: '🐦', category: '动物与自然' },{ id: 'e233', char: '🦅', category: '动物与自然' },
    { id: 'e234', char: '🦆', category: '动物与自然' },{ id: 'e235', char: '🦉', category: '动物与自然' },{ id: 'e236', char: '🐸', category: '动物与自然' },
    { id: 'e237', char: '🐊', category: '动物与自然' },{ id: 'e238', char: '🐢', category: '动物与自然' },{ id: 'e239', char: '🦎', category: '动物与自然' },
    { id: 'e240', char: '🐍', category: '动物与自然' },{ id: 'e241', char: '🐲', category: '动物与自然' },{ id: 'e242', char: '🐳', category: '动物与自然' },
    { id: 'e243', char: '🐬', category: '动物与自然' },{ id: 'e244', char: '🐟', category: '动物与自然' },{ id: 'e245', char: '🐠', category: '动物与自然' },
    { id: 'e246', char: '🐙', category: '动物与自然' },{ id: 'e247', char: '🦀', category: '动物与自然' },{ id: 'e248', char: '🦞', category: '动物与自然' },
    { id: 'e249', char: '🐌', category: '动物与自然' },{ id: 'e250', char: '🦋', category: '动物与自然' },{ id: 'e251', char: '🐛', category: '动物与自然' },
    { id: 'e252', char: '🐜', category: '动物与自然' },{ id: 'e253', char: '🐝', category: '动物与自然' },{ id: 'e254', char: '🐞', category: '动物与自然' },
    { id: 'e255', char: '🦗', category: '动物与自然' },{ id: 'e256', char: '🕷', category: '动物与自然' },{ id: 'e257', char: '🦂', category: '动物与自然' },
    { id: 'e258', char: '🌸', category: '动物与自然' },{ id: 'e259', char: '🌺', category: '动物与自然' },{ id: 'e260', char: '🌻', category: '动物与自然' },
    { id: 'e261', char: '🌹', category: '动物与自然' },{ id: 'e262', char: '🌷', category: '动物与自然' },{ id: 'e263', char: '💐', category: '动物与自然' },
    { id: 'e264', char: '🌼', category: '动物与自然' },{ id: 'e265', char: '🌾', category: '动物与自然' },{ id: 'e266', char: '🍀', category: '动物与自然' },
    { id: 'e267', char: '🍁', category: '动物与自然' },{ id: 'e268', char: '🍂', category: '动物与自然' },{ id: 'e269', char: '🍃', category: '动物与自然' },
    { id: 'e270', char: '🌿', category: '动物与自然' },{ id: 'e271', char: '🌵', category: '动物与自然' },{ id: 'e272', char: '🎄', category: '动物与自然' },
    { id: 'e273', char: '🌲', category: '动物与自然' },{ id: 'e274', char: '🌳', category: '动物与自然' },{ id: 'e275', char: '🌴', category: '动物与自然' },
    { id: 'e276', char: '🌱', category: '动物与自然' },{ id: 'e277', char: '🍄', category: '动物与自然' },{ id: 'e278', char: '🌰', category: '动物与自然' },
    { id: 'e279', char: '🌍', category: '动物与自然' },{ id: 'e280', char: '🌙', category: '动物与自然' },{ id: 'e281', char: '⭐', category: '动物与自然' },
    { id: 'e282', char: '🌟', category: '动物与自然' },{ id: 'e283', char: '✨', category: '动物与自然' },{ id: 'e284', char: '☀️', category: '动物与自然' },
    { id: 'e285', char: '🌤', category: '动物与自然' },{ id: 'e286', char: '⛅', category: '动物与自然' },{ id: 'e287', char: '🌧', category: '动物与自然' },
    { id: 'e288', char: '⛈', category: '动物与自然' },{ id: 'e289', char: '🌩', category: '动物与自然' },{ id: 'e290', char: '❄️', category: '动物与自然' },
    { id: 'e291', char: '☃️', category: '动物与自然' },{ id: 'e292', char: '🌈', category: '动物与自然' },{ id: 'e293', char: '🔥', category: '动物与自然' },
    { id: 'e294', char: '💧', category: '动物与自然' },{ id: 'e295', char: '🌊', category: '动物与自然' },

    // === 食物与饮料 ===
    { id: 'e301', char: '🍎', category: '食物与饮料' },{ id: 'e302', char: '🍏', category: '食物与饮料' },{ id: 'e303', char: '🍊', category: '食物与饮料' },
    { id: 'e304', char: '🍋', category: '食物与饮料' },{ id: 'e305', char: '🍌', category: '食物与饮料' },{ id: 'e306', char: '🍉', category: '食物与饮料' },
    { id: 'e307', char: '🍇', category: '食物与饮料' },{ id: 'e308', char: '🍓', category: '食物与饮料' },{ id: 'e309', char: '🍒', category: '食物与饮料' },
    { id: 'e310', char: '🍑', category: '食物与饮料' },{ id: 'e311', char: '🥭', category: '食物与饮料' },{ id: 'e312', char: '🍍', category: '食物与饮料' },
    { id: 'e313', char: '🥝', category: '食物与饮料' },{ id: 'e314', char: '🍅', category: '食物与饮料' },{ id: 'e315', char: '🥑', category: '食物与饮料' },
    { id: 'e316', char: '🥒', category: '食物与饮料' },{ id: 'e317', char: '🌶', category: '食物与饮料' },{ id: 'e318', char: '🌽', category: '食物与饮料' },
    { id: 'e319', char: '🥕', category: '食物与饮料' },{ id: 'e320', char: '🧄', category: '食物与饮料' },{ id: 'e321', char: '🧅', category: '食物与饮料' },
    { id: 'e322', char: '🥔', category: '食物与饮料' },{ id: 'e323', char: '🍠', category: '食物与饮料' },{ id: 'e324', char: '🥐', category: '食物与饮料' },
    { id: 'e325', char: '🍞', category: '食物与饮料' },{ id: 'e326', char: '🥖', category: '食物与饮料' },{ id: 'e327', char: '🥯', category: '食物与饮料' },
    { id: 'e328', char: '🧀', category: '食物与饮料' },{ id: 'e329', char: '🥚', category: '食物与饮料' },{ id: 'e330', char: '🍳', category: '食物与饮料' },
    { id: 'e331', char: '🥓', category: '食物与饮料' },{ id: 'e332', char: '🥩', category: '食物与饮料' },{ id: 'e333', char: '🍗', category: '食物与饮料' },
    { id: 'e334', char: '🍖', category: '食物与饮料' },{ id: 'e335', char: '🍔', category: '食物与饮料' },{ id: 'e336', char: '🍟', category: '食物与饮料' },
    { id: 'e337', char: '🍕', category: '食物与饮料' },{ id: 'e338', char: '🌭', category: '食物与饮料' },{ id: 'e339', char: '🥪', category: '食物与饮料' },
    { id: 'e340', char: '🌮', category: '食物与饮料' },{ id: 'e341', char: '🌯', category: '食物与饮料' },{ id: 'e342', char: '🥗', category: '食物与饮料' },
    { id: 'e343', char: '🍝', category: '食物与饮料' },{ id: 'e344', char: '🍜', category: '食物与饮料' },{ id: 'e345', char: '🍲', category: '食物与饮料' },
    { id: 'e346', char: '🍣', category: '食物与饮料' },{ id: 'e347', char: '🍤', category: '食物与饮料' },{ id: 'e348', char: '🍙', category: '食物与饮料' },
    { id: 'e349', char: '🍚', category: '食物与饮料' },{ id: 'e350', char: '🍘', category: '食物与饮料' },{ id: 'e351', char: '🍥', category: '食物与饮料' },
    { id: 'e352', char: '🥮', category: '食物与饮料' },{ id: 'e353', char: '🍡', category: '食物与饮料' },{ id: 'e354', char: '🍧', category: '食物与饮料' },
    { id: 'e355', char: '🍨', category: '食物与饮料' },{ id: 'e356', char: '🍦', category: '食物与饮料' },{ id: 'e357', char: '🍰', category: '食物与饮料' },
    { id: 'e358', char: '🎂', category: '食物与饮料' },{ id: 'e359', char: '🧁', category: '食物与饮料' },{ id: 'e360', char: '🍪', category: '食物与饮料' },
    { id: 'e361', char: '🍩', category: '食物与饮料' },{ id: 'e362', char: '🍫', category: '食物与饮料' },{ id: 'e363', char: '🍬', category: '食物与饮料' },
    { id: 'e364', char: '🍭', category: '食物与饮料' },{ id: 'e365', char: '🍿', category: '食物与饮料' },{ id: 'e366', char: '🧂', category: '食物与饮料' },
    { id: 'e367', char: '☕', category: '食物与饮料' },{ id: 'e368', char: '🍵', category: '食物与饮料' },{ id: 'e369', char: '🍶', category: '食物与饮料' },
    { id: 'e370', char: '🍺', category: '食物与饮料' },{ id: 'e371', char: '🍻', category: '食物与饮料' },{ id: 'e372', char: '🥂', category: '食物与饮料' },
    { id: 'e373', char: '🍷', category: '食物与饮料' },{ id: 'e374', char: '🥃', category: '食物与饮料' },{ id: 'e375', char: '🍸', category: '食物与饮料' },
    { id: 'e376', char: '🍹', category: '食物与饮料' },{ id: 'e377', char: '🧉', category: '食物与饮料' },{ id: 'e378', char: '🧊', category: '食物与饮料' },
    { id: 'e379', char: '🥤', category: '食物与饮料' },{ id: 'e380', char: '🧃', category: '食物与饮料' },

    // === 旅行与地点 ===
    { id: 'e401', char: '🚗', category: '旅行与地点' },{ id: 'e402', char: '🚕', category: '旅行与地点' },{ id: 'e403', char: '🚙', category: '旅行与地点' },
    { id: 'e404', char: '🚌', category: '旅行与地点' },{ id: 'e405', char: '🚎', category: '旅行与地点' },{ id: 'e406', char: '🏎', category: '旅行与地点' },
    { id: 'e407', char: '🚓', category: '旅行与地点' },{ id: 'e408', char: '🚑', category: '旅行与地点' },{ id: 'e409', char: '🚒', category: '旅行与地点' },
    { id: 'e410', char: '🚜', category: '旅行与地点' },{ id: 'e411', char: '🛻', category: '旅行与地点' },{ id: 'e412', char: '🚲', category: '旅行与地点' },
    { id: 'e413', char: '🛴', category: '旅行与地点' },{ id: 'e414', char: '🏍', category: '旅行与地点' },{ id: 'e415', char: '🚂', category: '旅行与地点' },
    { id: 'e416', char: '🚆', category: '旅行与地点' },{ id: 'e417', char: '🚇', category: '旅行与地点' },{ id: 'e418', char: '✈️', category: '旅行与地点' },
    { id: 'e419', char: '🛩', category: '旅行与地点' },{ id: 'e420', char: '🚀', category: '旅行与地点' },{ id: 'e421', char: '🛸', category: '旅行与地点' },
    { id: 'e422', char: '🚁', category: '旅行与地点' },{ id: 'e423', char: '⛵', category: '旅行与地点' },{ id: 'e424', char: '🚢', category: '旅行与地点' },
    { id: 'e425', char: '🛳', category: '旅行与地点' },{ id: 'e426', char: '🏠', category: '旅行与地点' },{ id: 'e427', char: '🏡', category: '旅行与地点' },
    { id: 'e428', char: '🏢', category: '旅行与地点' },{ id: 'e429', char: '🏪', category: '旅行与地点' },{ id: 'e430', char: '🏫', category: '旅行与地点' },
    { id: 'e431', char: '🏥', category: '旅行与地点' },{ id: 'e432', char: '🏦', category: '旅行与地点' },{ id: 'e433', char: '🏨', category: '旅行与地点' },
    { id: 'e434', char: '🏩', category: '旅行与地点' },{ id: 'e435', char: '⛪', category: '旅行与地点' },{ id: 'e436', char: '🕌', category: '旅行与地点' },
    { id: 'e437', char: '🕍', category: '旅行与地点' },{ id: 'e438', char: '⛩', category: '旅行与地点' },{ id: 'e439', char: '🗼', category: '旅行与地点' },
    { id: 'e440', char: '🗽', category: '旅行与地点' },{ id: 'e441', char: '🌋', category: '旅行与地点' },{ id: 'e442', char: '🏔', category: '旅行与地点' },
    { id: 'e443', char: '🏖', category: '旅行与地点' },{ id: 'e444', char: '🏜', category: '旅行与地点' },{ id: 'e445', char: '🏝', category: '旅行与地点' },
    { id: 'e446', char: '🏕', category: '旅行与地点' },{ id: 'e447', char: '🌅', category: '旅行与地点' },{ id: 'e448', char: '🌄', category: '旅行与地点' },
    { id: 'e449', char: '🌃', category: '旅行与地点' },{ id: 'e450', char: '🎡', category: '旅行与地点' },{ id: 'e451', char: '🎢', category: '旅行与地点' },

    // === 活动与运动 ===
    { id: 'e501', char: '⚽', category: '活动与运动' },{ id: 'e502', char: '🏀', category: '活动与运动' },{ id: 'e503', char: '🏈', category: '活动与运动' },
    { id: 'e504', char: '⚾', category: '活动与运动' },{ id: 'e505', char: '🥎', category: '活动与运动' },{ id: 'e506', char: '🎾', category: '活动与运动' },
    { id: 'e507', char: '🏐', category: '活动与运动' },{ id: 'e508', char: '🏉', category: '活动与运动' },{ id: 'e509', char: '🥏', category: '活动与运动' },
    { id: 'e510', char: '🎱', category: '活动与运动' },{ id: 'e511', char: '🏓', category: '活动与运动' },{ id: 'e512', char: '🏸', category: '活动与运动' },
    { id: 'e513', char: '🏒', category: '活动与运动' },{ id: 'e514', char: '🏑', category: '活动与运动' },{ id: 'e515', char: '🥊', category: '活动与运动' },
    { id: 'e516', char: '🥋', category: '活动与运动' },{ id: 'e517', char: '⛳', category: '活动与运动' },{ id: 'e518', char: '⛸', category: '活动与运动' },
    { id: 'e519', char: '🎣', category: '活动与运动' },{ id: 'e520', char: '🤿', category: '活动与运动' },{ id: 'e521', char: '🎿', category: '活动与运动' },
    { id: 'e522', char: '🏂', category: '活动与运动' },{ id: 'e523', char: '🪂', category: '活动与运动' },{ id: 'e524', char: '🏋', category: '活动与运动' },
    { id: 'e525', char: '🤸', category: '活动与运动' },{ id: 'e526', char: '⛹', category: '活动与运动' },{ id: 'e527', char: '🤾', category: '活动与运动' },
    { id: 'e528', char: '🏌', category: '活动与运动' },{ id: 'e529', char: '🏇', category: '活动与运动' },{ id: 'e530', char: '🏊', category: '活动与运动' },
    { id: 'e531', char: '🚴', category: '活动与运动' },{ id: 'e532', char: '🚵', category: '活动与运动' },{ id: 'e533', char: '🏆', category: '活动与运动' },
    { id: 'e534', char: '🥇', category: '活动与运动' },{ id: 'e535', char: '🥈', category: '活动与运动' },{ id: 'e536', char: '🥉', category: '活动与运动' },
    { id: 'e537', char: '🎮', category: '活动与运动' },{ id: 'e538', char: '🎲', category: '活动与运动' },{ id: 'e539', char: '🎯', category: '活动与运动' },
    { id: 'e540', char: '🎳', category: '活动与运动' },{ id: 'e541', char: '🎭', category: '活动与运动' },{ id: 'e542', char: '🎨', category: '活动与运动' },
    { id: 'e543', char: '🎤', category: '活动与运动' },{ id: 'e544', char: '🎧', category: '活动与运动' },{ id: 'e545', char: '🎼', category: '活动与运动' },
    { id: 'e546', char: '🎹', category: '活动与运动' },{ id: 'e547', char: '🥁', category: '活动与运动' },{ id: 'e548', char: '🎷', category: '活动与运动' },
    { id: 'e549', char: '🎺', category: '活动与运动' },{ id: 'e550', char: '🎸', category: '活动与运动' },{ id: 'e551', char: '🎻', category: '活动与运动' },

    // === 物品 ===
    { id: 'e601', char: '⌚', category: '物品' },{ id: 'e602', char: '📱', category: '物品' },{ id: 'e603', char: '💻', category: '物品' },
    { id: 'e604', char: '⌨️', category: '物品' },{ id: 'e605', char: '🖥', category: '物品' },{ id: 'e606', char: '🖨', category: '物品' },
    { id: 'e607', char: '🖱', category: '物品' },{ id: 'e608', char: '🖲', category: '物品' },{ id: 'e609', char: '📷', category: '物品' },
    { id: 'e610', char: '📸', category: '物品' },{ id: 'e611', char: '📹', category: '物品' },{ id: 'e612', char: '🎥', category: '物品' },
    { id: 'e613', char: '📽', category: '物品' },{ id: 'e614', char: '☎️', category: '物品' },{ id: 'e615', char: '📞', category: '物品' },
    { id: 'e616', char: '📟', category: '物品' },{ id: 'e617', char: '📺', category: '物品' },{ id: 'e618', char: '📻', category: '物品' },
    { id: 'e619', char: '⏰', category: '物品' },{ id: 'e620', char: '🕰', category: '物品' },{ id: 'e621', char: '⌛', category: '物品' },
    { id: 'e622', char: '⏳', category: '物品' },{ id: 'e623', char: '🔋', category: '物品' },{ id: 'e624', char: '🔌', category: '物品' },
    { id: 'e625', char: '💡', category: '物品' },{ id: 'e626', char: '🔦', category: '物品' },{ id: 'e627', char: '🕯', category: '物品' },
    { id: 'e628', char: '💰', category: '物品' },{ id: 'e629', char: '💳', category: '物品' },{ id: 'e630', char: '💎', category: '物品' },
    { id: 'e631', char: '🔨', category: '物品' },{ id: 'e632', char: '🪓', category: '物品' },{ id: 'e633', char: '⛏', category: '物品' },
    { id: 'e634', char: '🔧', category: '物品' },{ id: 'e635', char: '🔩', category: '物品' },{ id: 'e636', char: '⚙️', category: '物品' },
    { id: 'e637', char: '🗜', category: '物品' },{ id: 'e638', char: '🔫', category: '物品' },{ id: 'e639', char: '💣', category: '物品' },
    { id: 'e640', char: '🔪', category: '物品' },{ id: 'e641', char: '🗡', category: '物品' },{ id: 'e642', char: '⚔️', category: '物品' },
    { id: 'e643', char: '🛡', category: '物品' },{ id: 'e644', char: '🚬', category: '物品' },{ id: 'e645', char: '⚰️', category: '物品' },
    { id: 'e646', char: '⚱️', category: '物品' },{ id: 'e647', char: '📿', category: '物品' },{ id: 'e648', char: '💈', category: '物品' },
    { id: 'e649', char: '📖', category: '物品' },{ id: 'e650', char: '📚', category: '物品' },{ id: 'e651', char: '📔', category: '物品' },
    { id: 'e652', char: '📓', category: '物品' },{ id: 'e653', char: '📝', category: '物品' },{ id: 'e654', char: '✏️', category: '物品' },
    { id: 'e655', char: '🖊', category: '物品' },{ id: 'e656', char: '🖌', category: '物品' },{ id: 'e657', char: '🖍', category: '物品' },
    { id: 'e658', char: '📌', category: '物品' },{ id: 'e659', char: '📍', category: '物品' },{ id: 'e660', char: '📎', category: '物品' },
    { id: 'e661', char: '🖇', category: '物品' },{ id: 'e662', char: '📏', category: '物品' },{ id: 'e663', char: '📐', category: '物品' },
    { id: 'e664', char: '✂️', category: '物品' },{ id: 'e665', char: '📁', category: '物品' },{ id: 'e666', char: '🗂', category: '物品' },
    { id: 'e667', char: '🗑', category: '物品' },{ id: 'e668', char: '🔒', category: '物品' },{ id: 'e669', char: '🔓', category: '物品' },
    { id: 'e670', char: '🔑', category: '物品' },{ id: 'e671', char: '🗝', category: '物品' },{ id: 'e672', char: '🎁', category: '物品' },
    { id: 'e673', char: '🎀', category: '物品' },{ id: 'e674', char: '🎗', category: '物品' },{ id: 'e675', char: '🛒', category: '物品' },
    { id: 'e676', char: '🛍', category: '物品' },{ id: 'e677', char: '👑', category: '物品' },{ id: 'e678', char: '🎩', category: '物品' },
    { id: 'e679', char: '👒', category: '物品' },{ id: 'e680', char: '🎓', category: '物品' },{ id: 'e681', char: '💍', category: '物品' },
    { id: 'e682', char: '💄', category: '物品' },{ id: 'e683', char: '💋', category: '物品' },{ id: 'e684', char: '👠', category: '物品' },
    { id: 'e685', char: '👟', category: '物品' },{ id: 'e686', char: '🧣', category: '物品' },{ id: 'e687', char: '🧤', category: '物品' },
    { id: 'e688', char: '🧥', category: '物品' },{ id: 'e689', char: '👗', category: '物品' },{ id: 'e690', char: '👔', category: '物品' },
    { id: 'e691', char: '👜', category: '物品' },{ id: 'e692', char: '🎒', category: '物品' },{ id: 'e693', char: '👝', category: '物品' },
    { id: 'e694', char: '🧳', category: '物品' },{ id: 'e695', char: '☂️', category: '物品' },

    // === 符号与爱心 ===
    { id: 'e701', char: '❤️', category: '符号与爱心' },{ id: 'e702', char: '🧡', category: '符号与爱心' },{ id: 'e703', char: '💛', category: '符号与爱心' },
    { id: 'e704', char: '💚', category: '符号与爱心' },{ id: 'e705', char: '💙', category: '符号与爱心' },{ id: 'e706', char: '💜', category: '符号与爱心' },
    { id: 'e707', char: '🖤', category: '符号与爱心' },{ id: 'e708', char: '🤍', category: '符号与爱心' },{ id: 'e709', char: '🤎', category: '符号与爱心' },
    { id: 'e710', char: '💔', category: '符号与爱心' },{ id: 'e711', char: '❣️', category: '符号与爱心' },{ id: 'e712', char: '💕', category: '符号与爱心' },
    { id: 'e713', char: '💞', category: '符号与爱心' },{ id: 'e714', char: '💓', category: '符号与爱心' },{ id: 'e715', char: '💗', category: '符号与爱心' },
    { id: 'e716', char: '💖', category: '符号与爱心' },{ id: 'e717', char: '💘', category: '符号与爱心' },{ id: 'e718', char: '💝', category: '符号与爱心' },
    { id: 'e719', char: '💟', category: '符号与爱心' },{ id: 'e720', char: '☮️', category: '符号与爱心' },{ id: 'e721', char: '✝️', category: '符号与爱心' },
    { id: 'e722', char: '☪️', category: '符号与爱心' },{ id: 'e723', char: '🕉', category: '符号与爱心' },{ id: 'e724', char: '☸️', category: '符号与爱心' },
    { id: 'e725', char: '✡️', category: '符号与爱心' },{ id: 'e726', char: '🔯', category: '符号与爱心' },{ id: 'e727', char: '🕎', category: '符号与爱心' },
    { id: 'e728', char: '♈', category: '符号与爱心' },{ id: 'e729', char: '♉', category: '符号与爱心' },{ id: 'e730', char: '♊', category: '符号与爱心' },
    { id: 'e731', char: '♋', category: '符号与爱心' },{ id: 'e732', char: '♌', category: '符号与爱心' },{ id: 'e733', char: '♍', category: '符号与爱心' },
    { id: 'e734', char: '♎', category: '符号与爱心' },{ id: 'e735', char: '♏', category: '符号与爱心' },{ id: 'e736', char: '♐', category: '符号与爱心' },
    { id: 'e737', char: '♑', category: '符号与爱心' },{ id: 'e738', char: '♒', category: '符号与爱心' },{ id: 'e739', char: '♓', category: '符号与爱心' },
    { id: 'e740', char: '⛎', category: '符号与爱心' },{ id: 'e741', char: '🆔', category: '符号与爱心' },{ id: 'e742', char: '⚛️', category: '符号与爱心' },
    { id: 'e743', char: '🉑', category: '符号与爱心' },{ id: 'e744', char: '☢️', category: '符号与爱心' },{ id: 'e745', char: '☣️', category: '符号与爱心' },
    { id: 'e746', char: '📴', category: '符号与爱心' },{ id: 'e747', char: '📳', category: '符号与爱心' },{ id: 'e748', char: '🈶', category: '符号与爱心' },
    { id: 'e749', char: '🈚', category: '符号与爱心' },{ id: 'e750', char: '🈸', category: '符号与爱心' },{ id: 'e751', char: '🈺', category: '符号与爱心' },
    { id: 'e752', char: '🈷️', category: '符号与爱心' },{ id: 'e753', char: '✴️', category: '符号与爱心' },{ id: 'e754', char: '🆚', category: '符号与爱心' },
    { id: 'e755', char: '💮', category: '符号与爱心' },{ id: 'e756', char: '🉐', category: '符号与爱心' },{ id: 'e757', char: '㊙️', category: '符号与爱心' },
    { id: 'e758', char: '㊗️', category: '符号与爱心' },{ id: 'e759', char: '🈴', category: '符号与爱心' },{ id: 'e760', char: '🈵', category: '符号与爱心' },
    { id: 'e761', char: '🈹', category: '符号与爱心' },{ id: 'e762', char: '🈲', category: '符号与爱心' },{ id: 'e763', char: '🅰️', category: '符号与爱心' },
    { id: 'e764', char: '🅱️', category: '符号与爱心' },{ id: 'e765', char: '🆎', category: '符号与爱心' },{ id: 'e766', char: '🆑', category: '符号与爱心' },
    { id: 'e767', char: '🅾️', category: '符号与爱心' },{ id: 'e768', char: '🆘', category: '符号与爱心' },{ id: 'e769', char: '❌', category: '符号与爱心' },
    { id: 'e770', char: '⭕', category: '符号与爱心' },{ id: 'e771', char: '🛑', category: '符号与爱心' },{ id: 'e772', char: '⛔', category: '符号与爱心' },
    { id: 'e773', char: '📛', category: '符号与爱心' },{ id: 'e774', char: '♨️', category: '符号与爱心' },{ id: 'e775', char: '🉑', category: '符号与爱心' },
    { id: 'e776', char: '💯', category: '符号与爱心' },{ id: 'e777', char: '🔞', category: '符号与爱心' },{ id: 'e778', char: '🔰', category: '符号与爱心' },
    { id: 'e779', char: '⚠️', category: '符号与爱心' },{ id: 'e780', char: '🚸', category: '符号与爱心' },{ id: 'e781', char: '🔱', category: '符号与爱心' },
    { id: 'e782', char: '〽️', category: '符号与爱心' },{ id: 'e783', char: '✅', category: '符号与爱心' },{ id: 'e784', char: '❎', category: '符号与爱心' },
    { id: 'e785', char: '➿', category: '符号与爱心' },{ id: 'e786', char: '©️', category: '符号与爱心' },{ id: 'e787', char: '®️', category: '符号与爱心' },
    { id: 'e788', char: '™️', category: '符号与爱心' },{ id: 'e789', char: '🎵', category: '符号与爱心' },{ id: 'e790', char: '🔊', category: '符号与爱心' },
    { id: 'e791', char: '🔔', category: '符号与爱心' },{ id: 'e792', char: '🎶', category: '符号与爱心' },{ id: 'e793', char: '💬', category: '符号与爱心' },
    { id: 'e794', char: '🗯', category: '符号与爱心' },{ id: 'e795', char: '💭', category: '符号与爱心' },{ id: 'e796', char: '🗨', category: '符号与爱心' },
    { id: 'e797', char: '♠️', category: '符号与爱心' },{ id: 'e798', char: '♣️', category: '符号与爱心' },{ id: 'e799', char: '♥️', category: '符号与爱心' },
    { id: 'e800', char: '♦️', category: '符号与爱心' },{ id: 'e801', char: '🃏', category: '符号与爱心' },{ id: 'e802', char: '🀄', category: '符号与爱心' },
    { id: 'e803', char: '🕐', category: '符号与爱心' },

    // === 旗帜 ===
    { id: 'e901', char: '🏁', category: '旗帜' },{ id: 'e902', char: '🚩', category: '旗帜' },{ id: 'e903', char: '🎌', category: '旗帜' },
    { id: 'e904', char: '🏴', category: '旗帜' },{ id: 'e905', char: '🏳️', category: '旗帜' },{ id: 'e906', char: '🏳️‍🌈', category: '旗帜' },
    { id: 'e907', char: '🏳️‍⚧️', category: '旗帜' },{ id: 'e908', char: '🇨🇳', category: '旗帜' },{ id: 'e909', char: '🇭🇰', category: '旗帜' },
    { id: 'e910', char: '🇲🇴', category: '旗帜' },{ id: 'e911', char: '🇹🇼', category: '旗帜' },{ id: 'e912', char: '🇯🇵', category: '旗帜' },
    { id: 'e913', char: '🇰🇷', category: '旗帜' },{ id: 'e914', char: '🇺🇸', category: '旗帜' },{ id: 'e915', char: '🇬🇧', category: '旗帜' },
    { id: 'e916', char: '🇫🇷', category: '旗帜' },{ id: 'e917', char: '🇩🇪', category: '旗帜' },{ id: 'e918', char: '🇮🇹', category: '旗帜' },
    { id: 'e919', char: '🇷🇺', category: '旗帜' },{ id: 'e920', char: '🇨🇦', category: '旗帜' },{ id: 'e921', char: '🇦🇺', category: '旗帜' },
    { id: 'e922', char: '🇸🇬', category: '旗帜' },{ id: 'e923', char: '🇹🇭', category: '旗帜' },{ id: 'e924', char: '🇻🇳', category: '旗帜' },
    { id: 'e925', char: '🇮🇳', category: '旗帜' },{ id: 'e926', char: '🇧🇷', category: '旗帜' },{ id: 'e927', char: '🇪🇸', category: '旗帜' },
    { id: 'e928', char: '🇳🇱', category: '旗帜' },{ id: 'e929', char: '🇨🇭', category: '旗帜' },{ id: 'e930', char: '🇸🇪', category: '旗帜' }
  ],

  // 预置表情包（初始为空，用户自行上传）
  stickers: [],

  // 预置颜文字（按情绪分类）
  kaomojis: [
    // === 开心 ===
    { id: 'k001', text: '(◕‿◕)', category: '开心' },{ id: 'k002', text: '(｡♥︎‿♥︎｡)', category: '开心' },{ id: 'k003', text: '(◠‿◠✿)', category: '开心' },
    { id: 'k004', text: '(≧∇≦)/', category: '开心' },{ id: 'k005', text: 'ヽ(・∀・)ﾉ', category: '开心' },{ id: 'k006', text: '(＾▽＾)', category: '开心' },
    { id: 'k007', text: '(●´∀｀●)', category: '开心' },{ id: 'k008', text: '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', category: '开心' },{ id: 'k009', text: '٩(◕‿◕｡)۶', category: '开心' },
    { id: 'k010', text: '(✿◠‿◠)', category: '开心' },{ id: 'k011', text: '(*^▽^*)', category: '开心' },{ id: 'k012', text: '♡＾▽＾♡', category: '开心' },
    { id: 'k013', text: '╰(▔∀▔)╯', category: '开心' },{ id: 'k014', text: '(ᗒᗨᗕ)', category: '开心' },

    // === 伤心 ===
    { id: 'k101', text: '(╥﹏╥)', category: '伤心' },{ id: 'k102', text: '(╯︵╰,)', category: '伤心' },{ id: 'k103', text: '(ノ﹏ヽ)', category: '伤心' },
    { id: 'k104', text: '(｡•́︿•̀｡)', category: '伤心' },{ id: 'k105', text: '。・゜・(ノД`)・゜・。', category: '伤心' },{ id: 'k106', text: '(╥_╥)', category: '伤心' },
    { id: 'k107', text: '(´；ω；`)', category: '伤心' },{ id: 'k108', text: '(╯_╰)', category: '伤心' },{ id: 'k109', text: '〒▽〒', category: '伤心' },
    { id: 'k110', text: '(。_。)', category: '伤心' },{ id: 'k111', text: 'ಥ_ಥ', category: '伤心' },

    // === 生气 ===
    { id: 'k201', text: '(╯°□°）╯︵ ┻━┻', category: '生气' },{ id: 'k202', text: '(¬_¬)', category: '生气' },{ id: 'k203', text: '(｀皿´＃)', category: '生气' },
    { id: 'k204', text: '(╬ Ò﹏Ó)', category: '生气' },{ id: 'k205', text: 'ヽ(≧Д≦)ノ', category: '生气' },{ id: 'k206', text: '(｀Д´)', category: '生气' },
    { id: 'k207', text: '(`皿´)', category: '生气' },{ id: 'k208', text: '(｀へ´)', category: '生气' },

    // === 惊讶 ===
    { id: 'k301', text: '(°ロ°)', category: '惊讶' },{ id: 'k302', text: 'Σ(°△°|||)', category: '惊讶' },{ id: 'k303', text: '(⊙_⊙)', category: '惊讶' },
    { id: 'k304', text: 'w(°ｏ°)w', category: '惊讶' },{ id: 'k305', text: 'ヽ(°〇°)ﾉ', category: '惊讶' },{ id: 'k306', text: '(＠_＠;)', category: '惊讶' },
    { id: 'k307', text: '(●__●)', category: '惊讶' },{ id: 'k308', text: '∑(O_O;)', category: '惊讶' },

    // === 尴尬/无奈 ===
    { id: 'k401', text: 'ヽ(￣д￣;)ノ', category: '尴尬/无奈' },{ id: 'k402', text: '┐(´д`)┌', category: '尴尬/无奈' },{ id: 'k403', text: '(￣ω￣;)', category: '尴尬/无奈' },
    { id: 'k404', text: '(；一_一)', category: '尴尬/无奈' },{ id: 'k405', text: '(´-ω-`)', category: '尴尬/无奈' },{ id: 'k406', text: '(￣▽￣*)ゞ', category: '尴尬/无奈' },
    { id: 'k407', text: '(＾＾；)', category: '尴尬/无奈' },{ id: 'k408', text: '（；￣д￣）', category: '尴尬/无奈' },

    // === 爱心/喜欢 ===
    { id: 'k501', text: '(´∀｀)♡', category: '爱心/喜欢' },{ id: 'k502', text: '♡(◡‿◡✿)', category: '爱心/喜欢' },{ id: 'k503', text: '( ˘ ³˘)♥︎', category: '爱心/喜欢' },
    { id: 'k504', text: '(♥︎ω♥︎*)', category: '爱心/喜欢' },{ id: 'k505', text: '(｡･ω･｡)ﾉ♡', category: '爱心/喜欢' },{ id: 'k506', text: '♡＼(￣▽￣)／♡', category: '爱心/喜欢' },
    { id: 'k507', text: '(灬ºωº灬)♡', category: '爱心/喜欢' },

    // === 搞怪/调皮 ===
    { id: 'k601', text: '( ͡° ͜ʖ ͡°)', category: '搞怪/调皮' },{ id: 'k602', text: '(☞ﾟ∀ﾟ)☞', category: '搞怪/调皮' },{ id: 'k603', text: 'ᕕ(ᐛ)ᕗ', category: '搞怪/调皮' },
    { id: 'k604', text: '(づ｡◕‿‿◕｡)づ', category: '搞怪/调皮' },{ id: 'k605', text: '( 　･ω･)☞', category: '搞怪/调皮' },

    // === 加油/鼓励 ===
    { id: 'k701', text: '(ง •̀_•́)ง', category: '加油/鼓励' },{ id: 'k702', text: '(๑•̀ㅂ•́)و✧', category: '加油/鼓励' },{ id: 'k703', text: '╭( ･ㅂ･)و ̑̑ ', category: '加油/鼓励' },
    { id: 'k704', text: '٩(ˊᗜˋ*)و', category: '加油/鼓励' },{ id: 'k705', text: '(;｀O´)o', category: '加油/鼓励' },

    // === 害羞/抱歉 ===
    { id: 'k801', text: '(〃ω〃)', category: '害羞/抱歉' },{ id: 'k802', text: '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)', category: '害羞/抱歉' },
    { id: 'k803', text: '(｡•́︿•̀｡)', category: '害羞/抱歉' },{ id: 'k804', text: 'm(_ _)m', category: '害羞/抱歉' },

    // === 音乐 ===
    { id: 'k901', text: '♪(´ε｀ )', category: '音乐' },{ id: 'k902', text: '(〜￣▽￣)〜', category: '音乐' },{ id: 'k903', text: '♬♩♫♪☻(●´∀｀●）', category: '音乐' },
    { id: 'k904', text: '♪(┌・。・)┌', category: '音乐' },

    // === 动物 ===
    { id: 'ka01', text: 'ʕ·ᴥ·ʔ', category: '动物' },{ id: 'ka02', text: '(=^･ω･^=)', category: '动物' },{ id: 'ka03', text: '(=V●ᴥ●V=)', category: '动物' },
    { id: 'ka04', text: 'ʕ̡̢̡ʘ̅͟͜͡ʘ̲̅ʔ̢̡̢', category: '动物' }
  ],

  // 预置拍一拍（字卡界面分组管理，仅对方角色发布）
  pats: [
    { id: 'p1', text: '"我方"拍了拍"对方"：想你了', category: '基础' },
    { id: 'p2', text: '"我方"戳了戳"对方"：抱抱', category: '基础' },
    { id: 'p3', text: '"我方"拍了拍"对方"：晚安，梦里见', category: '基础' },
    { id: 'p4', text: '"我方"捏了捏"对方"：么么哒', category: '基础' },
    { id: 'p5', text: '"我方"摸了摸"对方"的小脑袋', category: '基础' }
  ]
};

window.DefaultData = DefaultData;


